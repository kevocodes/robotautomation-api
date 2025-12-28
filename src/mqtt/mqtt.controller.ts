import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PublishMessageDto } from './dto/publish-message.dto';
import { MqttService } from './mqtt.service';
import { ExecRoutineDto } from './dto/exec-routine.dto';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { RoutinesService } from './routines.service';
import { ApiResponse } from 'src/common/types/response.type';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('MQTT')
@Controller('mqtt')
export class MqttController {
  constructor(
    private readonly mqttService: MqttService,
    private readonly routinesService: RoutinesService,
  ) { }

  @Post('publish')
  async publish(
    @Body() body: PublishMessageDto,
  ): Promise<ApiResponse<Omit<PublishMessageDto, 'payload'>>> {
    const qos = body.qos ?? 0;
    const retain = body.retain ?? false;

    await this.mqttService.publish(body.topic, body.payload, {
      qos,
      retain,
    });

    return {
      data: {
        topic: body.topic,
        qos,
        retain,
      },
      message: 'Message published successfully',
      statusCode: HttpStatus.OK,
    };
  }

  @Post('exec-routine/:selectedResourceId')
  async executeRoutine(
    @Body() body: ExecRoutineDto,
    @Param('selectedResourceId', MongoIdPipe) selectedResourceId: string,
  ): Promise<ApiResponse<null>> {
    await this.routinesService.executeRoutine(body, selectedResourceId);

    return {
      data: null,
      message: 'Routine executed successfully',
      statusCode: HttpStatus.OK,
    };
  }

  @Sse('stream')
  stream(
    @Query('topic') topic?: string,
  ): Observable<MessageEvent> {
    if (!topic) {
      throw new BadRequestException('The "topic" query parameter is required');
    }

    return this.mqttService.streamTopic(topic);
  }
}
