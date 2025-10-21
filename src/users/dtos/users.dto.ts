import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
export class CreateUserDto {
  @Transform(({ value }) => value.trim())
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(({ value }) => value.trim())
  @IsString()
  @IsNotEmpty()
  lastname: string;

  @IsStrongPassword(
    {
      minLength: 6,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Password must contain at least 6 characters, 1 uppercase letter, 1 lowercase letter, 1 number and 1 special character.',
    },
  )
  password: string;

  @IsEmail()
  email: string;

  @IsEnum(Role, {
    message:
      'Invalid role. Valid options are ' + Object.values(Role).join(', '),
  })
  role: Role;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
