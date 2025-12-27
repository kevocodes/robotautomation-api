import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { Resource, Role, SelectedResource } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/role.decorator';
import { EmailVerifiedGuard } from 'src/common/guards/emailVerified.guard';
import { RolesGuardGuard } from 'src/common/guards/roles-guard.guard';
import { ResourcesService } from './resources.service';
import { ApiResponse } from 'src/common/types/response.type';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { AdjustSelectedResourcesPrioritiesDto } from './dtos/adjustSelectedResourcesPriorities';
import { ChangeRoomDirectionDto } from './dtos/changeRoomDirection';

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
  @Patch(':resourceId/select')
  async selectResource(
    @Param('resourceId', MongoIdPipe) resourceId: string,
  ): Promise<ApiResponse<SelectedResource>> {
    const selectedResource =
      await this.resourcesService.selectResource(resourceId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Resource selected successfully',
      data: selectedResource,
    };
  }

  @Roles(Role.ADMIN)
  @Patch(':selectedResourceId/deselect')
  async deselectResource(
    @Param('selectedResourceId', MongoIdPipe) selectedResourceId: string,
  ): Promise<ApiResponse> {
    await this.resourcesService.deselectResource(selectedResourceId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Resource deselected successfully',
      data: null,
    };
  }

  @Roles(Role.ADMIN, Role.USER)
  @Get('selected')
  async getSelectedResources(): Promise<ApiResponse> {
    const resources = await this.resourcesService.getSelectedResources();
    return {
      data: resources,
      statusCode: HttpStatus.OK,
      message: 'Selected resources retrieved successfully',
    };
  }

  @ApiBody({ type: AdjustSelectedResourcesPrioritiesDto })
  @Roles(Role.ADMIN)
  @Patch('/adjust-priorities')
  async adjustPriorities(
    @Body()
    body: AdjustSelectedResourcesPrioritiesDto,
  ): Promise<ApiResponse> {
    await this.resourcesService.adjustSelectedResourcesPriorities(
      body.orderedIds,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Selected resources priorities adjusted successfully',
      data: null,
    };
  }

  @ApiBody({ type: ChangeRoomDirectionDto })
  @Roles(Role.ADMIN)
  @Patch(':selectedResourceId/change-room-direction')
  async changeRoomDirection(
    @Param('selectedResourceId', MongoIdPipe)
    selectedResourceId: string,
    @Body() body: ChangeRoomDirectionDto,
  ): Promise<ApiResponse> {
    const updatedSelectedResource =
      await this.resourcesService.changeRoomDirection(
        selectedResourceId,
        body.roomDirection,
      );

    return {
      statusCode: HttpStatus.OK,
      message: 'Room direction changed successfully',
      data: updatedSelectedResource,
    };
  }
}
