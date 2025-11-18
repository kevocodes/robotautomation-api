import { CleaningTaskStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CleaningTaskDto {
  @IsString()
  eventId: string;

  @IsString()
  resourceId: string;

  @IsString()
  resourceName: string;

  @IsString()
  reservationReferenceNumber: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum(CleaningTaskStatus)
  status: CleaningTaskStatus;

  @IsOptional()
  @IsDateString()
  notifiedAt?: string | null;
}

export class CleaningScheduleStatusDto {
  @IsOptional()
  @IsDateString()
  lastVerificationAt?: string | null;

  @IsArray()
  pendingTasks: CleaningTaskDto[];
}

export class CleaningScheduleRefreshSummaryDto {
  @IsOptional()
  @IsDateString()
  lastVerificationAt?: string | null;

  refreshed: boolean;
  created: number;
  updated: number;
  removed: number;
  pending: number;
}
