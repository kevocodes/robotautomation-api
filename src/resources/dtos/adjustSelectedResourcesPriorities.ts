import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNumber } from 'class-validator';

export class AdjustSelectedResourcesPrioritiesDto {
  @ApiProperty({
    description: 'ID of the selected resource to adjust priority',
    example: '',
  })
  @IsMongoId()
  selectedResourceId: string;

  @ApiProperty({
    description: 'New priority for the selected resource',
    example: 2,
  })
  @IsNumber()
  newPriority: number;
}
