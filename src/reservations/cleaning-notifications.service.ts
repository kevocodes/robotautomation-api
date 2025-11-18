import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CleaningTask, Role } from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/config/prisma/prisma.service';
import { CleaningScheduleService } from './cleaning-schedule.service';
import { ReservationCleaningEvent } from './dtos/reservationCleaningEvent';

@Injectable()
export class CleaningNotificationsService {
  private readonly logger = new Logger(CleaningNotificationsService.name);

  constructor(
    private readonly cleaningScheduleService: CleaningScheduleService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCleaningNotifications(): Promise<void> {
    const now = new Date();
    try {
      const summary = await this.cleaningScheduleService.refreshIfDue();

      if (summary.refreshed) {
        this.logger.debug(
          `Cleaning tasks refreshed. Created: ${summary.created}, Updated: ${summary.updated}, Removed: ${summary.removed}`,
        );
      }

      const dueTasks = await this.cleaningScheduleService.getDueTasks(now);

      if (!dueTasks.length) {
        return;
      }

      const recipients = await this.getAdminRecipients();

      if (!recipients.length) {
        this.logger.warn(
          'Skipping cleaning notifications because no admin recipients are available.',
        );
        return;
      }

      await this.notifyTasks(dueTasks, recipients, now);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.stack ?? error.message : String(error);
      this.logger.error(
        `Failed to process cleaning notifications: ${errorMessage}`,
      );
    }
  }

  private async getAdminRecipients(): Promise<string[]> {
    const admins = await this.prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        emailVerified: true,
      },
      select: { email: true },
    });

    return admins
      .map(({ email }) => email)
      .filter((email): email is string => Boolean(email?.length));
  }

  private async notifyTasks(
    tasks: CleaningTask[],
    recipients: string[],
    reference: Date,
  ) {
    await Promise.all(
      tasks.map(async (task) => {
        const event: ReservationCleaningEvent = {
          id: task.eventId,
          reservationReferenceNumber: task.reservationReferenceNumber,
          resourceId: task.resourceId,
          startDate: task.startDate.toISOString(),
          endDate: task.endDate.toISOString(),
          resourceName: task.resourceName,
          color: task.color,
          textColor: task.textColor,
        };

        await this.mailService.sendCleaningStartedEmail(
          recipients,
          event,
          this.calculateDurationMinutes(task),
        );

        this.logger.log(
          `Cleaning notification sent for reservation ${task.reservationReferenceNumber} at resource ${task.resourceName}`,
        );
      }),
    );

    await this.cleaningScheduleService.markTasksAsNotified(
      tasks.map((task) => task.id),
      reference,
    );
  }

  private calculateDurationMinutes(task: CleaningTask): number {
    const start = task.startDate.getTime();
    const end = task.endDate.getTime();
    const differenceMinutes = Math.round((end - start) / 60_000);

    return Math.max(differenceMinutes, 1);
  }
}
