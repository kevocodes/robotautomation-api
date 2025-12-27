import { PublishMessageDto } from './publish-message.dto';
import { PickType } from '@nestjs/swagger';

export class ExecRoutineDto extends PickType(PublishMessageDto, [
  'qos',
  'retain',
] as const) {}
