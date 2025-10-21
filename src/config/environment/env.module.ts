import { Module } from '@nestjs/common';
import { ConfigModule as ConfigSetup } from '@nestjs/config';
import configuration from './env.config';
import envSchema from './env.schema';

@Module({
  imports: [
    ConfigSetup.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envSchema,
    }),
  ],
})
export class EnvModule {}
