import { IsEmail, IsNotEmpty, IsStrongPassword } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ChangePasswordDto {
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
}
