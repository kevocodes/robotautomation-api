import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import * as bcrypt from 'bcrypt';

import { User, Role } from '@prisma/client';
import { PrismaService } from 'src/config/prisma/prisma.service';
import { prismaExclude } from 'src/common/utils/exclude-arguments';
import { ApiResponse } from 'src/common/types/response.type';
import envConfig from 'src/config/environment/env.config';
import { CreateUserDto, UpdateUserDto } from './dtos/users.dto';
import { TokenPayload } from 'src/auth/types/token.type';

@Injectable()
export class UsersService {
  constructor(
    @Inject(envConfig.KEY)
    private readonly config: ConfigType<typeof envConfig>,
    private readonly prismaService: PrismaService,
  ) {}

  async create(userData: CreateUserDto): Promise<ApiResponse> {
    const userExists = await this.prismaService.user.findUnique({
      where: {
        email: userData.email,
      },
    });

    if (userExists) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(
      userData.password,
      this.config.hash.rounds,
    );

    userData.password = hashedPassword;

    const user = await this.prismaService.user.create({
      data: userData,
    });

    delete user.password;

    return {
      statusCode: HttpStatus.CREATED,
      message: 'User created',
      data: user,
    };
  }

  async findAll(user: TokenPayload): Promise<ApiResponse> {
    const users = await this.prismaService.user.findMany({
      select: prismaExclude('User', ['password']),
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        id: {
          not: user.sub,
        },
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Users found',
      data: users,
    };
  }

  async findOneById(id: string): Promise<ApiResponse> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    delete user.password;

    return {
      statusCode: HttpStatus.OK,
      message: 'User found',
      data: user,
    };
  }

  async updateOneById(
    id: string,
    userData: UpdateUserDto,
    currentUser: TokenPayload,
  ): Promise<ApiResponse> {
    const { email: currentEmail } = await this.findOneBySub(currentUser.sub);

    const isAdmin = currentUser.role === Role.ADMIN;

    const needsToReverifyEmail =
      userData.email && userData.email !== currentEmail;

    // Check if not admin user is trying to update another user
    if (!isAdmin && currentUser.sub !== id) {
      throw new BadRequestException('You can only update your own user');
    }

    // Check if not admin user is trying to update role
    if (!isAdmin && userData.role) {
      throw new BadRequestException('You cannot update your own role');
    }

    // Check if user exists
    const { data: user } = await this.findOneById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if new email is already in use
    if (userData.email && userData.email !== user.email) {
      const isEmailTaken = await this.prismaService.user.findUnique({
        where: {
          email: userData.email,
        },
      });

      if (isEmailTaken) {
        throw new ConflictException('The new email is already in use');
      }
    }

    if (userData.password) {
      const hashedPassword = await bcrypt.hash(
        userData.password,
        this.config.hash.rounds,
      );

      userData.password = hashedPassword;
    }

    const updatedUser = await this.prismaService.user.update({
      where: {
        id,
      },
      data: {
        ...userData,
        emailVerified: needsToReverifyEmail ? false : true,
      },
    });

    delete updatedUser.password;

    return {
      statusCode: HttpStatus.OK,
      message: 'User updated',
      data: updatedUser,
    };
  }

  async deleteOneById(id: string): Promise<ApiResponse> {
    // Check if user exists
    const { data: user } = await this.findOneById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prismaService.user.delete({
      where: {
        id,
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'User deleted',
      data: null,
    };
  }

  //--------------------------------
  //  Auxiliar service methods
  //--------------------------------
  async findOneByEmail(email: string): Promise<User> {
    const user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });

    return user;
  }

  async findOneBySub(id: string): Promise<User> {
    const user = await this.prismaService.user.findUnique({
      where: {
        id,
      },
    });

    return user;
  }

  async findOneByResetPasswordToken(token: string): Promise<User> {
    const user = await this.prismaService.user.findFirst({
      where: {
        resetPasswordToken: token,
      },
    });

    return user;
  }

  async saveVerifyOTP(
    userId: string,
    otp: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        emailVerificationOTP: otp,
        emailVerificationExpires: expiresAt,
      },
    });
  }

  async saveForgotPasswordToken(email: string, token: string) {
    await this.prismaService.user.update({
      where: {
        email: email,
      },
      data: {
        resetPasswordToken: token,
      },
    });
  }

  async verifyEmail(user: User): Promise<void> {
    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: true,
        emailVerificationOTP: null,
        emailVerificationExpires: null,
      },
    });
  }

  async changePassword(user: User, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(
      newPassword,
      this.config.hash.rounds,
    );

    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
      },
    });
  }
}
