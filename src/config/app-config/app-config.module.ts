import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';
@Module({
  imports: [
    // Registra el módulo de caché.
    // TTL (Time-To-Live) de 3600 segundos (1 hora).
    // Puedes ajustar 'ttl' según tus necesidades.
    CacheModule.register({
      ttl: 3600,
    }),
    PrismaModule, // Provee el PrismaService
  ],
  providers: [AppConfigService],
  exports: [AppConfigService], // Exporta el servicio para que otros módulos puedan usarlo
  controllers: [AppConfigController],
})
export class AppConfigModule {}
