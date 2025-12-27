import { ApiProperty } from '@nestjs/swagger';
import { RoomDirection } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeRoomDirectionDto {
  @ApiProperty({
    enum: RoomDirection,
    description: 'New room direction for the selected resource',
  })
  @IsEnum(RoomDirection, { message: 'Invalid room direction' })
  readonly roomDirection: RoomDirection;
}
