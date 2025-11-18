import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PublishMessageDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsNotEmpty()
  payload: unknown;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  qos?: 0 | 1 | 2;

  @IsOptional()
  @IsBoolean()
  retain?: boolean;
}
