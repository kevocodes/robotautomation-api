// ./src/external-resource/external-resource.service.ts

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/config/prisma/prisma.service';
import { DeiBookingHttpService } from 'src/dei-booking/dei-booking-http.service';
import { ResourcesDeiResponse } from './dtos/resourcesDeiResponse';
import { Prisma, Resource, SelectedResource } from '@prisma/client';

@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name);
  private readonly resourcesPath = '/Resources/';

  constructor(
    private readonly prisma: PrismaService,
    private readonly deiBookingApi: DeiBookingHttpService,
  ) {}

  async getAllActiveResources() {
    return this.prisma.resource.findMany({
      where: { isActive: true },
    });
  }

  async getOneById(id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
    });

    if (!resource) throw new NotFoundException('Resource not found');

    return resource;
  }

  async selectResource(id: string): Promise<SelectedResource> {
    const resource = await this.getOneById(id);

    // Check if already selected
    const existingSelection = await this.prisma.selectedResource.findUnique({
      where: { resourceId: resource.id },
    });

    if (existingSelection)
      throw new BadRequestException('Resource is already selected');

    // Determine next priority
    const { _max } = await this.prisma.selectedResource.aggregate({
      _max: { priority: true },
    });

    const nextPriority = (_max.priority ?? 0) + 1;

    const selectedResource = await this.prisma.selectedResource.create({
      data: {
        resourceId: resource.id,
        priority: nextPriority,
      },
    });

    return selectedResource;
  }

  async getSelectedResources(): Promise<
    (SelectedResource & { resource: Resource })[]
  > {
    const selectedResources = await this.prisma.selectedResource.findMany({
      include: { resource: true },
      orderBy: { priority: 'asc' },
    });

    return selectedResources;
  }

  async deselectResource(idSelectedResource: string): Promise<void> {
    const selectedResource = await this.prisma.selectedResource.findUnique({
      where: { id: idSelectedResource },
    });

    if (!selectedResource) {
      throw new NotFoundException('Resource selection not found');
    }

    // Delete the selected resource
    const { priority } = await this.prisma.selectedResource.delete({
      where: { id: idSelectedResource },
    });

    // Readjust priorities
    await this.prisma.selectedResource.updateMany({
      where: {
        priority: { gt: priority },
      },
      data: {
        priority: {
          decrement: 1,
        },
      },
    });
  }

  async adjustSelectedResourcesPriorities(orderedIds: string[]): Promise<void> {
    if (!orderedIds.length) {
      throw new BadRequestException('orderedIds cannot be empty');
    }

    const uniqueIds = new Set(orderedIds);
    if (uniqueIds.size !== orderedIds.length) {
      throw new BadRequestException('orderedIds must contain unique values');
    }

    const selectedResources = await this.prisma.selectedResource.findMany({
      select: { id: true },
      orderBy: { priority: 'asc' },
    });

    if (selectedResources.length !== orderedIds.length) {
      throw new BadRequestException(
        'orderedIds must include every selected resource',
      );
    }

    const selectedIds = new Set(selectedResources.map(({ id }) => id));

    for (const id of orderedIds) {
      if (!selectedIds.has(id)) {
        throw new BadRequestException(`Selected resource ${id} does not exist`);
      }
    }

    const updateOperations = orderedIds.map((id, index) =>
      this.prisma.selectedResource.update({
        where: { id },
        data: { priority: index + 1 },
      }),
    );

    try {
      await this.prisma.$transaction(updateOperations);
    } catch (error) {
      this.logger.error(
        'Failed to adjust selected resources priorities',
        (error as Error).stack,
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ConflictException(
          'Cannot adjust priorities due to a data conflict',
        );
      }

      throw new InternalServerErrorException(
        'Unexpected error adjusting selected resources priorities',
      );
    }
  }

  /**
   * Tarea programada.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Iniciando sincronización de recursos externos...');
    await this.synchronizeResources();
    this.logger.log('Sincronización completada.');
  }

  /**
   * Lógica principal de sincronización
   */
  private async synchronizeResources() {
    try {
      // 1. OBTENER DATOS EXTERNOS
      const { data } = await this.deiBookingApi.get<ResourcesDeiResponse>(
        this.resourcesPath,
      );

      const externalResources = data.resources;

      // 2. OBTENER DATOS LOCALES
      const localResources = await this.prisma.resource.findMany();

      // 3. MAPEAR DATOS LOCALES para búsqueda rápida
      // (externalId -> localResource)
      const localResourceMap = new Map(
        localResources.map((res) => [res.externalResourceId, res]),
      );

      // Almacenará todas las operaciones de DB para una transacción
      const operations = [];
      const externalIdsInSync = new Set<string>();

      // 4. COMPARAR: Bucle para CREAR y ACTUALIZAR
      for (const extRes of externalResources) {
        externalIdsInSync.add(extRes.resourceId);
        const localMatch = localResourceMap.get(extRes.resourceId);

        const resourceData = {
          name: extRes.name,
          location: extRes.location,
          externalResourceId: extRes.resourceId,
          isActive: true, // Asegurarse de que esté activo
        };

        if (localMatch) {
          // --- ESTRATEGIA DE ACTUALIZACIÓN ---
          // Si existe, revisa si algo cambió
          if (
            localMatch.name !== extRes.name ||
            localMatch.location !== extRes.location ||
            !localMatch.isActive // Reactivar si fue borrado
          ) {
            operations.push(
              this.prisma.resource.update({
                where: { id: localMatch.id },
                data: resourceData,
              }),
            );
          }
        } else {
          // --- ESTRATEGIA DE CREACIÓN ---
          // Si no existe, lo crea
          operations.push(this.prisma.resource.create({ data: resourceData }));
        }
      }

      // 5. ESTRATEGIA DE BORRADO (Soft Delete)
      // Buscar recursos locales que ya NO están en la API externa
      const resourcesToDeactivate = localResources.filter(
        (localRes) =>
          !externalIdsInSync.has(localRes.externalResourceId) &&
          localRes.isActive,
      );

      if (resourcesToDeactivate.length > 0) {
        const idsToDeactivate = resourcesToDeactivate.map((res) => res.id);
        operations.push(
          this.prisma.resource.updateMany({
            where: { id: { in: idsToDeactivate } },
            data: { isActive: false }, // <-- Soft Delete
          }),
        );
      }

      // 6. EJECUTAR TODO EN UNA TRANSACCIÓN
      if (operations.length > 0) {
        await this.prisma.$transaction(operations);
        this.logger.log(
          `Sincronización exitosa: ${operations.length} operaciones realizadas.`,
        );
      } else {
        this.logger.log('No se requirieron cambios.');
      }
    } catch (error) {
      this.logger.error('Falló la sincronización de recursos', error.stack);
    }
  }
}
