import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { IsGreaterOrEqualThan } from 'src/common/validators/is-greater-or-equal-than';

export class GetAppConfigDto {
  @IsInt()
  @Min(1)
  cleaningStartOffsetMinutes: number;

  @IsInt()
  @Min(1)
  cleaningDurationMinutes: number;

  @IsInt()
  @Min(1)
  cleaningVerificationFrequencyMinutes: number;

  @IsInt()
  @Min(1)
  @IsGreaterOrEqualThan('cleaningVerificationFrequencyMinutes', {
    message:
      'cleaningLookAheadMinutes debe ser mayor o igual que cleaningVerificationFrequencyMinutes',
  })
  cleaningLookAheadMinutes: number;

  @IsOptional()
  @IsDateString()
  lastCleaningVerificationAt?: string | null;
}
