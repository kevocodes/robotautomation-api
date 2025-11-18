import { PartialType } from '@nestjs/swagger';
import { GetAppConfigDto } from './get-app-config.dto';

export class UpdateAppConfigDto extends PartialType(GetAppConfigDto) {}
