import { Module } from '@nestjs/common';
import { EnvModule } from './environment/env.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppConfigModule } from './app-config/app-config.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [EnvModule, PrismaModule, AppConfigModule, CloudinaryModule],
})
export class ConfigModule {}
