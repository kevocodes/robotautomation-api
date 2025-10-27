import { IsInt, Min } from 'class-validator';

export class GetAppConfigDto {
  @IsInt()
  @Min(0)
  cleaningStartOffsetMinutes: number;
}
