import { Injectable, Logger } from '@nestjs/common';
import { CleaningTaskStatus, GlobalConfig } from '@prisma/client';
import { AppConfigService } from 'src/config/app-config/app-config.service';
import { PrismaService } from 'src/config/prisma/prisma.service';
import { ReservationsService } from './reservations.service';
import { FindAllReservationsQueryDto } from './dtos/findAllReservationsQuery';

type RefreshSummary = {
  refreshed: boolean;
  created: number;
  updated: number;
  removed: number;
  pending: number;
  lastVerificationAt: Date | null;
};

@Injectable()
export class CleaningScheduleService {
  private readonly logger = new Logger(CleaningScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservationsService: ReservationsService,
    private readonly appConfigService: AppConfigService,
  ) {}

  async refreshIfDue(): Promise<RefreshSummary> {
    return this.refreshUpcomingCleanings(false);
  }

  async manualRefresh(): Promise<RefreshSummary> {
    return this.refreshUpcomingCleanings(true);
  }

  async getStatus() {
    const config = await this.appConfigService.getSettings();
    const pendingTasks = await this.prisma.cleaningTask.findMany({
      where: { status: CleaningTaskStatus.PENDING },
      orderBy: { startDate: 'asc' },
      take: 10,
    });

    return {
      lastVerificationAt: config.lastCleaningVerificationAt,
      pendingTasks: pendingTasks.map((task) => ({
        id: task.id,
        eventId: task.eventId,
        resourceId: task.resourceId,
        resourceName: task.resourceName,
        reservationReferenceNumber: task.reservationReferenceNumber,
        startDate: task.startDate.toISOString(),
        endDate: task.endDate.toISOString(),
        status: task.status,
        notifiedAt: task.notifiedAt ? task.notifiedAt.toISOString() : null,
      })),
    };
  }

  async getDueTasks(reference: Date) {
    return this.prisma.cleaningTask.findMany({
      where: {
        status: CleaningTaskStatus.PENDING,
        startDate: { lte: reference },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async markTasksAsNotified(taskIds: string[], notifiedAt: Date) {
    if (!taskIds.length) {
      return;
    }

    await this.prisma.cleaningTask.updateMany({
      where: { id: { in: taskIds } },
      data: {
        status: CleaningTaskStatus.NOTIFIED,
        notifiedAt,
      },
    });
  }

  private async refreshUpcomingCleanings(
    force: boolean,
  ): Promise<RefreshSummary> {
    const now = new Date();
    const config = await this.appConfigService.getSettings();

    if (!force && !this.shouldRefresh(config, now)) {
      return {
        refreshed: false,
        created: 0,
        updated: 0,
        removed: 0,
        pending: await this.countPendingTasks(),
        lastVerificationAt: config.lastCleaningVerificationAt ?? null,
      };
    }

    const windowEnd = this.shiftMinutes(now, config.cleaningLookAheadMinutes);

    const query: FindAllReservationsQueryDto = {
      startDateTime: now.toISOString(),
      endDateTime: windowEnd.toISOString(),
    };

    const contextReservations =
      await this.reservationsService.getCleaningContext(query);

    const events = await this.reservationsService.generateCleaningEvents(
      contextReservations,
      contextReservations,
    );

    const upcomingEvents = events.filter((event) => {
      const start = new Date(event.startDate);
      return start >= now && start <= windowEnd;
    });

    const eventIds = new Set<string>();
    let created = 0;
    let updated = 0;

    for (const event of upcomingEvents) {
      eventIds.add(event.id);
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);

      const existing = await this.prisma.cleaningTask.findUnique({
        where: { eventId: event.id },
      });

      if (existing) {
        await this.prisma.cleaningTask.update({
          where: { eventId: event.id },
          data: {
            resourceId: event.resourceId,
            resourceName: event.resourceName,
            reservationReferenceNumber: event.reservationReferenceNumber,
            startDate,
            endDate,
            color: event.color,
            textColor: event.textColor,
            status:
              existing.status === CleaningTaskStatus.NOTIFIED
                ? CleaningTaskStatus.NOTIFIED
                : CleaningTaskStatus.PENDING,
          },
        });
        updated += 1;
        continue;
      }

      await this.prisma.cleaningTask.create({
        data: {
          eventId: event.id,
          resourceId: event.resourceId,
          resourceName: event.resourceName,
          reservationReferenceNumber: event.reservationReferenceNumber,
          startDate,
          endDate,
          color: event.color,
          textColor: event.textColor,
          status: CleaningTaskStatus.PENDING,
        },
      });
      created += 1;
    }

    const removed = await this.removeObsoleteTasks(eventIds, now);

    await this.appConfigService.updateSettings({
      lastCleaningVerificationAt: now.toISOString(),
    });

    return {
      refreshed: true,
      created,
      updated,
      removed,
      pending: await this.countPendingTasks(),
      lastVerificationAt: now,
    };
  }

  private shouldRefresh(config: GlobalConfig, reference: Date): boolean {
    if (!config.lastCleaningVerificationAt) {
      return true;
    }

    const last = config.lastCleaningVerificationAt;
    const elapsedMinutes = (reference.getTime() - last.getTime()) / 60_000;

    return elapsedMinutes >= config.cleaningVerificationFrequencyMinutes;
  }

  private async removeObsoleteTasks(
    validEventIds: Set<string>,
    reference: Date,
  ): Promise<number> {
    if (!validEventIds.size) {
      const result = await this.prisma.cleaningTask.deleteMany({
        where: {
          status: CleaningTaskStatus.PENDING,
          startDate: { gte: reference },
        },
      });
      return result.count;
    }

    const result = await this.prisma.cleaningTask.deleteMany({
      where: {
        status: CleaningTaskStatus.PENDING,
        startDate: { gte: reference },
        eventId: {
          notIn: Array.from(validEventIds),
        },
      },
    });

    return result.count;
  }

  private async countPendingTasks(): Promise<number> {
    return this.prisma.cleaningTask.count({
      where: { status: CleaningTaskStatus.PENDING },
    });
  }

  private shiftMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }
}
