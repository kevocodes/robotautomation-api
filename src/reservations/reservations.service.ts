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
  ): Promise<ReservationDeiResponseWithCleaningEvents> {
    try {
      const response = await this.deiBookingApi.get<ReservationDeiResponse>(
        this.reservationsPath,
        { params: query },
      );

      const cleaningEvents = await this.generateCleaningEvents(
        response.data.reservations,
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

  async generateCleaningEvents(
    reservations: Reservation[],
  ): Promise<ReservationCleaningEvent[]> {
    if (!reservations?.length) {
      return [];
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
      return [];
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

    const cleaningEvents: ReservationCleaningEvent[] = [];
    let currentGroup: ReservationCandidate[] = [];
    let currentGroupEnd = 0;

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

      cleaningEvents.push(this.buildCleaningEvent(currentGroup));
      currentGroup = [candidate];
      currentGroupEnd = candidate.cleaningEnd.getTime();
    }

    if (currentGroup.length) {
      cleaningEvents.push(this.buildCleaningEvent(currentGroup));
    }

    return cleaningEvents;
  }

  private buildCleaningEvent(
    group: {
      reservation: Reservation;
      cleaningStart: Date;
      cleaningEnd: Date;
      priority: number;
    }[],
  ): ReservationCleaningEvent {
    const winner = group.reduce((best, current) => {
      if (current.priority < best.priority) {
        return current;
      }

      if (current.priority === best.priority) {
        const startDiff =
          current.cleaningStart.getTime() - best.cleaningStart.getTime();
        if (startDiff < 0) {
          return current;
        }

        if (startDiff === 0) {
          return current.reservation.referenceNumber.localeCompare(
            best.reservation.referenceNumber,
          ) < 0
            ? current
            : best;
        }
      }

      return best;
    }, group[0]);

    return {
      startDate: winner.cleaningStart.toISOString(),
      endDate: winner.cleaningEnd.toISOString(),
      resourceName: winner.reservation.resourceName,
      color: winner.reservation.color,
      textColor: winner.reservation.textColor,
    };
  }

  private shiftMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }
}
