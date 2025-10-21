import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiResponse } from 'src/common/types/response.type';
import { CreateUserDto, UpdateUserDto } from './dtos/users.dto';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/role.decorator';
import { Role } from '@prisma/client';
import { RolesGuardGuard } from 'src/common/guards/roles-guard.guard';
import { User } from 'src/common/decorators/current-user.decorator';
import { TokenPayload } from 'src/auth/types/token.type';
import { EmailVerifiedGuard } from 'src/common/guards/emailVerified.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuardGuard, EmailVerifiedGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Roles(Role.ADMIN)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        lastname: { type: 'string' },
        password: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'enum', enum: ['ADMIN', 'USER'] },
      },
    },
  })
  @Post()
  async create(@Body() body: CreateUserDto): Promise<ApiResponse> {
    return this.userService.create(body);
  }

  @Roles(Role.ADMIN)
  @Get()
  async findAll(@User() user: TokenPayload): Promise<ApiResponse> {
    return this.userService.findAll(user);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  async findOneById(
    @Param('id', MongoIdPipe) id: string,
  ): Promise<ApiResponse> {
    return this.userService.findOneById(id);
  }

  @Roles(Role.ADMIN, Role.USER)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        lastname: { type: 'string' },
        password: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'enum', enum: ['USER', 'ADMIN'] },
      },
    },
  })
  @Put(':id')
  async update(
    @User() user: TokenPayload,
    @Body() body: UpdateUserDto,
    @Param('id', MongoIdPipe) id: string,
  ): Promise<ApiResponse> {
    return this.userService.updateOneById(id, body, user);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  async delete(@Param('id', MongoIdPipe) id: string): Promise<ApiResponse> {
    return this.userService.deleteOneById(id);
  }
}
