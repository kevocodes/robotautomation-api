import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';

export class AdjustSelectedResourcesPrioritiesDto {
  @ApiProperty({
    type: [String],
    description: 'IDs de SelectedResource en el nuevo orden (down-top)',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  orderedIds: string[];
}
