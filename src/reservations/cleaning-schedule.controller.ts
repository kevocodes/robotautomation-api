import { Controller, Get, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from 'src/common/guards/emailVerified.guard';
import { RolesGuardGuard } from 'src/common/guards/roles-guard.guard';
import { Roles } from 'src/common/decorators/role.decorator';
import { Role } from '@prisma/client';
import { CleaningScheduleService } from './cleaning-schedule.service';
import {
  CleaningScheduleRefreshSummaryDto,
  CleaningScheduleStatusDto,
} from './dtos/cleaningScheduleStatusDto';
import { ApiResponse } from 'src/common/types/response.type';

@ApiTags('Cleaning Schedule')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuardGuard, EmailVerifiedGuard)
@Roles(Role.ADMIN)
@Controller('reservations/cleaning-schedule')
export class CleaningScheduleController {
  constructor(
    private readonly cleaningScheduleService: CleaningScheduleService,
  ) {}

  @Get('status')
  async getStatus(): Promise<ApiResponse<CleaningScheduleStatusDto>> {
    const status = await this.cleaningScheduleService.getStatus();

    return {
      statusCode: HttpStatus.OK,
      message: 'Cleaning schedule status retrieved successfully',
      data: {
        lastVerificationAt: status.lastVerificationAt
          ? status.lastVerificationAt.toISOString()
          : null,
        pendingTasks: status.pendingTasks,
      },
    };
  }

  @Post('refresh')
  async refresh(): Promise<ApiResponse<CleaningScheduleRefreshSummaryDto>> {
    const summary = await this.cleaningScheduleService.manualRefresh();

    return {
      statusCode: HttpStatus.OK,
      message: summary.refreshed
        ? 'Cleaning schedule refreshed successfully'
        : 'Cleaning schedule refresh skipped (recently updated)',
      data: {
        refreshed: summary.refreshed,
        created: summary.created,
        updated: summary.updated,
        removed: summary.removed,
        pending: summary.pending,
        lastVerificationAt: summary.lastVerificationAt
          ? summary.lastVerificationAt.toISOString()
          : null,
      },
    };
  }
}
