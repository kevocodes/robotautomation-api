import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { DeiBookingModule } from 'src/dei-booking/dei-booking.module';

@Module({
  imports: [DeiBookingModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
