import { Injectable } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { AppConfigService } from 'src/config/app-config/app-config.service';
import { ExecRoutineDto } from './dto/exec-routine.dto';
import { leftRoutine, rightRoutine } from './constants/routines';
import { RoomDirection } from '@prisma/client';
import { ResourcesService } from 'src/resources/resources.service';
import { minutesToMilliseconds } from 'src/common/utils/time-conversion';

@Injectable()
export class RoutinesService {
  constructor(
    private readonly mqttService: MqttService,
    private readonly appConfigService: AppConfigService,
    private readonly resourcesService: ResourcesService,
  ) {}

  async executeRoutine(body: ExecRoutineDto, selectedResourceId: string) {
    const selectedResource =
      await this.resourcesService.getSelectedResourceById(selectedResourceId);

    const routineTopic = '/robot/routine';
    const qos = body.qos ?? 0;
    const retain = body.retain ?? false;

    const appConfig = await this.appConfigService.getSettings();
    const cleaningDuration = appConfig.cleaningDurationMinutes;

    const routine =
      selectedResource.roomDirection === RoomDirection.LEFT
        ? leftRoutine
        : rightRoutine;

    const payload = {
      duration: minutesToMilliseconds(cleaningDuration),
      steps: routine,
    };

    await this.mqttService.publish(routineTopic, JSON.stringify(payload), {
      qos,
      retain,
    });
  }
}
