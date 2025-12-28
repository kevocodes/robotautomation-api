import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import { ResourcesModule } from 'src/resources/resources.module';
import { RoutinesService } from './routines.service';
import { AppConfigModule } from 'src/config/app-config/app-config.module';

@Module({
  controllers: [MqttController],
  providers: [MqttService, RoutinesService],
  exports: [MqttService, RoutinesService],
  imports: [ResourcesModule, AppConfigModule],
})
export class MqttModule {}
