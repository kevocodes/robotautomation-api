import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { DeiBookingModule } from 'src/dei-booking/dei-booking.module';
import { AppConfigModule } from 'src/config/app-config/app-config.module';
import { ReservationsService } from './reservations.service';
import { CleaningNotificationsService } from './cleaning-notifications.service';
import { MailModule } from 'src/mail/mail.module';
import { CleaningScheduleService } from './cleaning-schedule.service';
import { CleaningScheduleController } from './cleaning-schedule.controller';

@Module({
  imports: [DeiBookingModule, AppConfigModule, MailModule],
  controllers: [ReservationsController, CleaningScheduleController],
  providers: [
    ReservationsService,
    CleaningNotificationsService,
    CleaningScheduleService,
  ],
})
export class ReservationsModule {}
