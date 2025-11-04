import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { DeiBookingHttpService } from 'src/dei-booking/dei-booking-http.service';
import {
  Reservation,
  ReservationDeiResponse,
  ReservationDeiResponseWithCleaningEvents,
} from './dtos/reservationsDeiResponse';
import { FindAllReservationsQueryDto } from './dtos/findAllReservationsQuery';
import { ReservationCleaningEvent } from './dtos/reservationCleaningEvent';
import { AppConfigService } from 'src/config/app-config/app-config.service';
import { PrismaService } from 'src/config/prisma/prisma.service';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);
  private readonly reservationsPath = '/Reservations/';

  constructor(
    private readonly deiBookingApi: DeiBookingHttpService,
    private readonly appConfigService: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getAllReservations(
    query: FindAllReservationsQueryDto,
    contextReservations?: Reservation[],
    allowedResourceIds?: Set<string>,
  ): Promise<ReservationDeiResponseWithCleaningEvents> {
    try {
      const response = await this.deiBookingApi.get<ReservationDeiResponse>(
        this.reservationsPath,
        { params: query },
      );

      const externalContext =
        contextReservations ?? (await this.getCleaningContext(query));

      const mergedContext = this.mergeReservationCollections(
        externalContext,
        response.data.reservations,
      );

      const resourceFilter =
        allowedResourceIds ??
        (query.resourceId !== undefined
          ? new Set([String(query.resourceId)])
          : undefined);

      const cleaningEvents = await this.generateCleaningEvents(
        response.data.reservations,
        mergedContext,
        resourceFilter,
      );

      return {
        ...response.data,
        cleaningEvents,
      };
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;

      const errorMessage =
        axiosError.response?.data?.message ??
        axiosError.message ??
        'Unknown error while fetching reservations';
      this.logger.error(
        `DEI Booking reservations request failed: ${errorMessage}`,
      );

      throw new BadGatewayException(
        'No fue posible obtener las reservaciones desde DEI Booking',
      );
    }
  }

  async getCleaningContext(
    query: FindAllReservationsQueryDto,
  ): Promise<Reservation[]> {
    const selectedResources = await this.prisma.selectedResource.findMany({
      include: { resource: true },
    });
    1;
    if (!selectedResources.length) {
      return [];
    }

    const { resourceId, ...baseQuery } = query;
    void resourceId; // Ignore resourceId from the base query

    try {
      const reservationBatches = await Promise.all(
        selectedResources
          .map((selectedResource) => {
            const externalResourceId =
              selectedResource.resource?.externalResourceId;

            if (!externalResourceId?.length) {
              this.logger.warn(
                `Skipping selected resource ${selectedResource.id} due to missing externalResourceId`,
              );
              return null;
            }

            const parsedResourceId = Number(externalResourceId);

            if (!Number.isFinite(parsedResourceId)) {
              this.logger.warn(
                `Skipping selected resource ${selectedResource.id} due to invalid externalResourceId ${externalResourceId}`,
              );
              return null;
            }

            return this.deiBookingApi
              .get<ReservationDeiResponse>(this.reservationsPath, {
                params: {
                  ...baseQuery,
                  resourceId: parsedResourceId,
                },
              })
              .then((response) => response.data.reservations);
          })
          .filter(
            (value): value is Promise<ReservationDeiResponse['reservations']> =>
              value !== null,
          ),
      );

      return this.mergeReservationCollections(...reservationBatches);
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;

      const errorMessage =
        axiosError.response?.data?.message ??
        axiosError.message ??
        'Unknown error while fetching reservations';

      this.logger.error(
        `Failed to fetch reservations for cleaning context: ${errorMessage}`,
      );

      throw new BadGatewayException(
        'No fue posible obtener las reservaciones desde DEI Booking',
      );
    }
  }

  async generateCleaningEvents(
    reservations: Reservation[],
    contextReservations?: Reservation[],
    allowedResourceIds?: Set<string>,
  ): Promise<ReservationCleaningEvent[]> {
    if (!reservations?.length) {
      return [];
    }

    const schedule = await this.buildCleaningSchedule(
      contextReservations?.length ? contextReservations : reservations,
    );

    const seenReservations = new Set<string>();
    const cleaningEvents: ReservationCleaningEvent[] = [];

    for (const reservation of reservations) {
      const reservationKey = this.getReservationKey(reservation);

      if (seenReservations.has(reservationKey)) {
        continue;
      }

      seenReservations.add(reservationKey);

      const entry = schedule.get(reservationKey);

      if (!entry) {
        continue;
      }

      if (allowedResourceIds && !allowedResourceIds.has(entry.resourceId)) {
        continue;
      }

      cleaningEvents.push(entry.event);
    }

    return cleaningEvents;
  }

  private async buildCleaningSchedule(
    reservations: Reservation[],
  ): Promise<
    Map<string, { event: ReservationCleaningEvent; resourceId: string }>
  > {
    if (!reservations?.length) {
      return new Map();
    }

    const [config, selectedResources] = await Promise.all([
      this.appConfigService.getSettings(),
      this.prisma.selectedResource.findMany({
        include: { resource: true },
      }),
    ]);

    const priorityMap = new Map<string, number>();
    for (const selectedResource of selectedResources) {
      const externalId = selectedResource.resource?.externalResourceId;
      if (externalId) {
        priorityMap.set(externalId, selectedResource.priority);
      }
    }

    type ReservationCandidate = {
      reservation: Reservation;
      cleaningStart: Date;
      cleaningEnd: Date;
      priority: number;
    };

    const defaultPriority = Number.MAX_SAFE_INTEGER;

    const candidates: ReservationCandidate[] = [];

    for (const reservation of reservations) {
      const start = new Date(reservation.startDate);
      const end = new Date(reservation.endDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        this.logger.warn(
          `Skipping reservation ${reservation.referenceNumber} due to invalid dates`,
        );
        continue;
      }

      const cleaningStart = this.shiftMinutes(
        start,
        -config.cleaningStartOffsetMinutes,
      );
      const cleaningEnd = this.shiftMinutes(
        cleaningStart,
        config.cleaningDurationMinutes,
      );
      const priority =
        priorityMap.get(reservation.resourceId) ?? defaultPriority;

      candidates.push({
        reservation,
        cleaningStart,
        cleaningEnd,
        priority,
      });
    }

    if (!candidates.length) {
      return new Map();
    }

    candidates.sort((a, b) => {
      const startDiff = a.cleaningStart.getTime() - b.cleaningStart.getTime();
      if (startDiff !== 0) {
        return startDiff;
      }

      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      return a.reservation.referenceNumber.localeCompare(
        b.reservation.referenceNumber,
      );
    });

    const schedule = new Map<
      string,
      { event: ReservationCleaningEvent; resourceId: string }
    >();
    let currentGroup: ReservationCandidate[] = [];
    let currentGroupEnd = 0;

    const finalizeGroup = (group: ReservationCandidate[]) => {
      const winner = this.selectWinner(group);
      schedule.set(this.getReservationKey(winner.reservation), {
        event: this.buildCleaningEventFromCandidate(winner),
        resourceId: winner.reservation.resourceId,
      });
    };

    for (const candidate of candidates) {
      if (!currentGroup.length) {
        currentGroup.push(candidate);
        currentGroupEnd = candidate.cleaningEnd.getTime();
        continue;
      }

      if (candidate.cleaningStart.getTime() < currentGroupEnd) {
        currentGroup.push(candidate);
        currentGroupEnd = Math.max(
          currentGroupEnd,
          candidate.cleaningEnd.getTime(),
        );
        continue;
      }

      finalizeGroup(currentGroup);
      currentGroup = [candidate];
      currentGroupEnd = candidate.cleaningEnd.getTime();
    }

    if (currentGroup.length) {
      finalizeGroup(currentGroup);
    }

    return schedule;
  }

  private selectWinner(
    group: {
      reservation: Reservation;
      cleaningStart: Date;
      cleaningEnd: Date;
      priority: number;
    }[],
  ) {
    return group.reduce((best, current) => {
      if (
        current.priority < best.priority ||
        (current.priority === best.priority &&
          current.cleaningStart.getTime() < best.cleaningStart.getTime()) ||
        (current.priority === best.priority &&
          current.cleaningStart.getTime() === best.cleaningStart.getTime() &&
          current.reservation.referenceNumber.localeCompare(
            best.reservation.referenceNumber,
          ) < 0)
      ) {
        return current;
      }

      return best;
    }, group[0]);
  }

  private buildCleaningEventFromCandidate(candidate: {
    reservation: Reservation;
    cleaningStart: Date;
    cleaningEnd: Date;
  }): ReservationCleaningEvent {
    return {
      startDate: candidate.cleaningStart.toISOString(),
      endDate: candidate.cleaningEnd.toISOString(),
      resourceName: candidate.reservation.resourceName,
      color: candidate.reservation.color,
      textColor: candidate.reservation.textColor,
    };
  }

  private mergeReservationCollections(
    ...collections: (Reservation[] | undefined)[]
  ): Reservation[] {
    const merged = new Map<string, Reservation>();

    for (const collection of collections) {
      if (!collection?.length) {
        continue;
      }

      for (const reservation of collection) {
        const key = this.getReservationKey(reservation);

        if (!merged.has(key)) {
          merged.set(key, reservation);
        }
      }
    }

    return Array.from(merged.values());
  }

  private getReservationKey(reservation: Reservation): string {
    return `${reservation.referenceNumber}::${reservation.resourceId}`;
  }

  private shiftMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }
}
