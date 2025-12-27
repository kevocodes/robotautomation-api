import {
  BadRequestException,
  Body,
  Controller,
  MessageEvent,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PublishMessageDto } from './dto/publish-message.dto';
import { MqttService } from './mqtt.service';

@Controller('mqtt')
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Post('publish')
  async publish(@Body() body: PublishMessageDto) {
    const qos = body.qos ?? 0;
    const retain = body.retain ?? false;

    await this.mqttService.publish(body.topic, body.payload, {
      qos,
      retain,
    });

    return {
      topic: body.topic,
      qos,
      retain,
    };
  }

  @Sse('stream')
  stream(@Query('topic') topic?: string): Observable<MessageEvent> {
    if (!topic) {
      throw new BadRequestException('The "topic" query parameter is required');
    }

    return this.mqttService.streamTopic(topic);
  }
}
