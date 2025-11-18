import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { DeiBookingModule } from 'src/dei-booking/dei-booking.module';
import { AppConfigModule } from 'src/config/app-config/app-config.module';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [DeiBookingModule, AppConfigModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
