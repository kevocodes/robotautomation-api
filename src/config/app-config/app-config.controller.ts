import {
  Controller,
  Get,
  Patch,
  Body,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { GlobalConfig, Role } from '@prisma/client';
import { UpdateAppConfigDto } from './dtos/update-app-config.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GetAppConfigDto } from './dtos/get-app-config.dto';
import { ApiResponse } from 'src/common/types/response.type';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuardGuard } from 'src/common/guards/roles-guard.guard';
import { EmailVerifiedGuard } from 'src/common/guards/emailVerified.guard';
import { Roles } from 'src/common/decorators/role.decorator';

@ApiTags('App Config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuardGuard, EmailVerifiedGuard)
@Roles(Role.ADMIN)
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly configService: AppConfigService) {}

  /**
   * Endpoint para obtener la configuración global.
   */
  @Get()
  async getSettings(): Promise<ApiResponse<GetAppConfigDto>> {
    // El servicio se encarga de leer desde el caché o la DB
    const settings = await this.configService.getSettings();
    const payload: GetAppConfigDto = {
      cleaningStartOffsetMinutes: settings.cleaningStartOffsetMinutes,
      cleaningDurationMinutes: settings.cleaningDurationMinutes,
      cleaningVerificationFrequencyMinutes:
        settings.cleaningVerificationFrequencyMinutes,
      cleaningLookAheadMinutes: settings.cleaningLookAheadMinutes,
      lastCleaningVerificationAt: settings.lastCleaningVerificationAt
        ? settings.lastCleaningVerificationAt.toISOString()
        : null,
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Settings retrieved successfully',
      data: payload,
    };
  }

  /**
   * Endpoint para actualizar la configuración global.
   */
  @Patch()
  async updateSettings(
    @Body() updateConfigDto: UpdateAppConfigDto,
  ): Promise<ApiResponse<GlobalConfig>> {
    // El servicio se encarga de actualizar la DB e invalidar el caché
    return {
      statusCode: HttpStatus.OK,
      message: 'Settings updated successfully',
      data: await this.configService.updateSettings(updateConfigDto),
    };
  }
}
