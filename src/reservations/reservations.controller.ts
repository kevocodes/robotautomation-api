import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from 'src/common/guards/emailVerified.guard';
import { RolesGuardGuard } from 'src/common/guards/roles-guard.guard';
import { ReservationsService } from './reservations.service';
import { ApiResponse } from 'src/common/types/response.type';
import { Roles } from 'src/common/decorators/role.decorator';
import { Role } from '@prisma/client';
import { FindAllReservationsQueryDto } from './dtos/findAllReservationsQuery';
import { GetAllReservationsByResourcesQueryDto } from './dtos/finAllReservationsByResources';
import { ReservationDeiResponse } from './dtos/reservationsDeiResponse';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuardGuard, EmailVerifiedGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Roles(Role.ADMIN, Role.USER)
  @Get()
  async getAllReservations(
    @Query() query: FindAllReservationsQueryDto,
  ): Promise<ApiResponse<ReservationDeiResponse>> {
    const reservations =
      await this.reservationsService.getAllReservations(query);

    return {
      statusCode: HttpStatus.OK,
      message: 'Reservations retrieved successfully',
      data: reservations,
    };
  }

  @Roles(Role.ADMIN, Role.USER)
  @Get('by-resources')
  async getAllReservationsByResources(
    @Query() params: GetAllReservationsByResourcesQueryDto,
  ): Promise<ApiResponse<ReservationDeiResponse>> {
    const reservationsResponse = await Promise.all(
      params.resourceIds.map((resourceId) =>
        this.reservationsService.getAllReservations({
          resourceId,
          startDateTime: params.startDateTime,
          endDateTime: params.endDateTime,
        }),
      ),
    );

    const reservations = reservationsResponse
      .map((res) => res.reservations)
      .flat();

    return {
      statusCode: HttpStatus.OK,
      message: 'Upcoming reservations retrieved successfully',
      data: {
        links: [],
        message: null,
        reservations,
        startDateTime: params.startDateTime,
        endDateTime: params.endDateTime,
      },
    };
  }
}
