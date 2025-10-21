import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login.dto';
import { ApiResponse } from 'src/common/types/response.type';
import { JwtService } from '@nestjs/jwt';
import { TokenPayload } from './types/token.type';
import { MailService } from 'src/mail/mail.service';
import envConfig from 'src/config/environment/env.config';
import { ConfigType } from '@nestjs/config';

import * as dayjs from 'dayjs';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    @Inject(envConfig.KEY)
    private readonly envConfiguration: ConfigType<typeof envConfig>,
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async login(loginInfo: LoginDto): Promise<ApiResponse> {
    const user = await this.userService.findOneByEmail(loginInfo.email);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatchPassword = await bcrypt.compare(
      loginInfo.password,
      user.password,
    );

    if (!isMatchPassword)
      throw new UnauthorizedException('Invalid credentials');

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullname: `${user.name} ${user.lastname}`,
    };

    const access_token = this.jwtService.sign(payload);

    delete user.password;

    return {
      statusCode: 200,
      message: 'Login successfully',
      data: {
        access_token,
        user,
      },
    };
  }

  async sendVerificationEmail(user: TokenPayload): Promise<ApiResponse> {
    const currentUser = await this.userService.findOneBySub(user.sub);

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    if (currentUser.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    if (
      currentUser.emailVerificationOTP &&
      currentUser.emailVerificationExpires
    ) {
      const expiresAt = currentUser.emailVerificationExpires;

      if (dayjs().isBefore(expiresAt)) {
        throw new ConflictException(
          `OTP already sent and expires at: ${expiresAt.toISOString()}`,
        );
      }
    }

    const otp = String(this.generateOTP());
    const duration = this.envConfiguration.OTP.expiresIn;
    const expiresAt = dayjs().add(duration, 'minutes');

    await this.userService.saveVerifyOTP(
      currentUser.id,
      otp,
      expiresAt.toDate(),
    );

    await this.mailService.sendVerificationEmail(
      currentUser.name,
      currentUser.email,
      otp,
      expiresAt.format('DD/MM/YYYY HH:mm:ss'),
    );

    return {
      statusCode: 200,
      message: 'Verification email sent',
      data: { expiresAt },
    };
  }

  async sendForgotPasswordEmail(email: string): Promise<ApiResponse> {
    const user = await this.userService.findOneByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = await this.generatePasswordJWT(email);
    const expiresAt = this.getTokenExpirationIsoDate(token);

    await this.userService.saveForgotPasswordToken(email, token);

    await this.mailService.sendForgotPasswordEmail(
      user.name,
      user.email,
      expiresAt,
      token,
    );

    return {
      statusCode: 200,
      message: 'Forgot password email sent',
      data: null,
    };
  }

  async verifyEmail(user: TokenPayload, otp: string): Promise<ApiResponse> {
    const response = await this.userService.findOneById(user.sub);
    const currentUser = response.data as User;

    const currentOtp = currentUser.emailVerificationOTP;
    const expiresAt = currentUser.emailVerificationExpires;

    if (otp !== currentOtp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (dayjs().isAfter(expiresAt)) {
      throw new BadRequestException('OTP expired');
    }

    await this.userService.verifyEmail(currentUser);

    return {
      statusCode: 200,
      message: 'Email verified',
      data: null,
    };
  }

  async verifyForgotPasswordToken(token: string): Promise<ApiResponse> {
    const user = await this.userService.findOneByResetPasswordToken(token);

    if (!user) {
      throw new NotFoundException('This token does not belong to any user');
    }

    await this.validateJWT(token);

    return {
      statusCode: 200,
      message: 'Token verified',
      data: null,
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<ApiResponse> {
    const user = await this.userService.findOneByResetPasswordToken(token);

    if (!user) {
      throw new NotFoundException('This token does not belong to any user');
    }

    await this.validateJWT(token);

    await this.userService.changePassword(user, newPassword);

    return {
      statusCode: 200,
      message: 'Password updated successfully',
      data: null,
    };
  }

  // --------------------
  // Helper functions
  // --------------------
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  generatePasswordJWT(email: string): Promise<string> {
    const minutes = this.envConfiguration.forgotPassword.expiresIn;

    return this.jwtService.signAsync(
      { sub: email },
      {
        expiresIn: `${minutes}m`,
      },
    );
  }

  async validateJWT(token: string): Promise<void> {
    try {
      await this.jwtService.verifyAsync(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  getTokenExpirationIsoDate(token: string): string {
    try {
      const { exp } = this.jwtService.verify(token);

      return dayjs.unix(exp).toISOString();
    } catch (error) {
      throw new InternalServerErrorException(
        'Error getting token expiration date',
      );
    }
  }
}
