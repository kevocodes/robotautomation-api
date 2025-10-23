import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DeiBookingAuthService } from './dei-booking-auth.service';
import { DeiBookingHttpService } from './dei-booking-http.service';

@Module({
  imports: [CacheModule.register()],
  providers: [DeiBookingAuthService, DeiBookingHttpService],
  exports: [DeiBookingAuthService, DeiBookingHttpService],
})
export class DeiBookingModule {}
