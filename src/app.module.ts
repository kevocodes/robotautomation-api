import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import envConfig from './config/environment/env.config';
import { ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CloudinaryModule } from './config/cloudinary/cloudinary.module';
import { DeiBookingModule } from './dei-booking/dei-booking.module';
import { ReservationsModule } from './reservations/reservations.module';
@Module({
  imports: [
    AuthModule,
    ConfigModule,
    UsersModule,
    MailModule,
    DeiBookingModule,
    ThrottlerModule.forRootAsync({
      inject: [envConfig.KEY],
      useFactory: (configService: ConfigType<typeof envConfig>) => [
        {
          limit: configService.rateLimit.default.limit,
          ttl: seconds(configService.rateLimit.default.ttl),
        },
        {
          name: 'email',
          limit: configService.rateLimit.email.limit,
          ttl: seconds(configService.rateLimit.email.ttl),
        },
      ],
    }),
    CloudinaryModule,
    ReservationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
