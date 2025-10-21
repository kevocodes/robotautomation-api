import { Module } from '@nestjs/common';
import { EnvModule } from './environment/env.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [EnvModule, PrismaModule],
})
export class ConfigModule {}
