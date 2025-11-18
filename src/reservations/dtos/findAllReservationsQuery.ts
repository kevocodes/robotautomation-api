import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional } from 'class-validator';

export class FindAllReservationsQueryDto {
  @ApiPropertyOptional({
    format: 'date-time',
    example: '2025-10-20T22:32:21Z',
  })
  @IsOptional()
  @IsDateString()
  startDateTime?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    example: '2025-10-21T22:32:21Z',
  })
  @IsOptional()
  @IsDateString()
  endDateTime?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  resourceId?: number;
}
