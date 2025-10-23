import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from 'src/common/guards/emailVerified.guard';
import { RolesGuardGuard } from 'src/common/guards/roles-guard.guard';
import { ReservationsService } from './reservations.service';
import { ApiResponse } from 'src/common/types/response.type';
import { Roles } from 'src/common/decorators/role.decorator';
import { Role } from '@prisma/client';
import { FindAllReservationsQueryDto } from './dtos/findAllReservationsQuery';

@ApiTags('reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuardGuard, EmailVerifiedGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Roles(Role.ADMIN, Role.USER)
  @Get()
  async getAllReservations(
    @Query() query: FindAllReservationsQueryDto,
  ): Promise<ApiResponse> {
    const reservations =
      await this.reservationsService.getAllReservations(query);

    return {
      statusCode: 200,
      message: 'Reservations retrieved successfully',
      data: reservations,
    };
  }
}
