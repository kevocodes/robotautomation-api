import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class ReservationCleaningEvent {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  reservationReferenceNumber: string;

  @IsNotEmpty()
  @IsString()
  resourceId: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsNotEmpty()
  @IsString()
  resourceName: string;

  @IsNotEmpty()
  @IsString()
  color: string;

  @IsNotEmpty()
  @IsString()
  textColor: string;
}
