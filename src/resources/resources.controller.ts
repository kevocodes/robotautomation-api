import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Resource, Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/role.decorator';
import { EmailVerifiedGuard } from 'src/common/guards/emailVerified.guard';
import { RolesGuardGuard } from 'src/common/guards/roles-guard.guard';
import { ResourcesService } from './resources.service';
import { ApiResponse } from 'src/common/types/response.type';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';

@ApiTags('Resources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuardGuard, EmailVerifiedGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Roles(Role.ADMIN, Role.USER)
  @Get()
  async getAllResources(): Promise<ApiResponse<Resource[]>> {
    const resources = await this.resourcesService.getAllActiveResources();
    return {
      data: resources,
      statusCode: HttpStatus.OK,
      message: 'Resources retrieved successfully',
    };
  }

  @Roles(Role.ADMIN)
  @Patch(':id/toggle-select')
  async toggleSelectResource(
    @Param('id', MongoIdPipe) id: string,
  ): Promise<ApiResponse> {
    await this.resourcesService.toggleSelectResource(id);

    return {
      statusCode: HttpStatus.OK,
      message: 'Resource selection toggled successfully',
      data: null,
    };
  }

  @Roles(Role.ADMIN, Role.USER)
  @Get('selected')
  async getSelectedResources(): Promise<ApiResponse<Resource[]>> {
    const resources = await this.resourcesService.getSelectedResources();
    return {
      data: resources,
      statusCode: HttpStatus.OK,
      message: 'Selected resources retrieved successfully',
    };
  }
}
