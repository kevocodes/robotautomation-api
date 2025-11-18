import {
  IsArray,
  ArrayNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetAllReservationsByResourcesQueryDto {
  @ApiProperty({
    type: [Number],
    example: [1, 2, 3],
    description:
      'IDs de recursos. Acepta un solo ID, múltiples IDs (?id=1&id=2) o separados por comas (?id=1,2,3).',
  })
  /*
    Transforma la entrada (string, string[], o string separado por comas)
    en un array de strings.
   */
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value; // Ya es un array (e.g., ["1", "2"])
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value.split(','); // Soporta "1,2,3"
    }
    if (value === null || typeof value === 'undefined' || value === '') {
      return []; // Manejar caso vacío
    }
    return [value]; // Es un solo string (e.g., "12"), envolverlo
  })
  // 3. Tus decoradores ahora funcionan en el orden correcto
  @IsArray()
  @ArrayNotEmpty()
  // 4. @Type convierte el array de strings (salida de @Transform)
  //    en un array de números.
  @Type(() => Number)
  // 5. @IsInt valida que cada elemento del array sea un número.
  @IsInt({ each: true })
  resourceIds: number[];

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
}
