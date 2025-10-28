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

  async adjustSelectedResourcesPriorities(
    idSelectedResource: string,
    newPriority: number,
  ): Promise<void> {
    const selectedResource = await this.prisma.selectedResource.findUnique({
      where: { id: idSelectedResource },
    });

    if (!selectedResource) {
      throw new NotFoundException('Resource selection not found');
    }

    const currentPriority = selectedResource.priority;

    if (newPriority === currentPriority) return;

    const totalSelected = await this.prisma.selectedResource.count();

    if (newPriority < 1 || newPriority > totalSelected) {
      throw new BadRequestException('Priority out of range');
    }

    const isMovingUp = newPriority < currentPriority;

    // Envolvemos la transacción en un try...catch
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. "Aparcar" el recurso
        await tx.selectedResource.update({
          where: { id: idSelectedResource },
          data: { priority: -1 }, // Valor temporal
        });

        // 2. "Desplazar" los otros recursos
        await tx.selectedResource.updateMany({
          where: {
            id: { not: idSelectedResource },
            priority: isMovingUp
              ? { gte: newPriority, lt: currentPriority }
              : { lte: newPriority, gt: currentPriority },
          },
          data: isMovingUp
            ? { priority: { increment: 1 } }
            : { priority: { decrement: 1 } },
        });

        // 3. "Colocar" el recurso en su nueva posición
        await tx.selectedResource.update({
          where: { id: idSelectedResource },
          data: { priority: newPriority },
        });
      });
    } catch (error) {
      // Manejo de errores de Prisma
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Código 'P2034' es para "Transaction failed due to a write conflict or a deadlock".
        // Esto es común en operaciones de reordenamiento con alta concurrencia.
        if (error.code === 'P2034') {
          throw new ConflictException(
            'Concurrency conflict. The list was modified by another user. Please try again.',
          );
        }
      }

      // Para cualquier otro error de DB o error inesperado
      throw new InternalServerErrorException(
        'An error occurred while reordering the resources.',
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
