// ./src/external-resource/external-resource.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/config/prisma/prisma.service';
import { DeiBookingHttpService } from 'src/dei-booking/dei-booking-http.service';
import { ResourcesDeiResponse } from './dtos/resourcesDeiResponse';

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

  async toggleSelectResource(id: string) {
    const resource = await this.getOneById(id);

    await this.prisma.resource.update({
      where: { id },
      data: { isSelected: !resource.isSelected },
    });
  }

  async getSelectedResources() {
    return this.prisma.resource.findMany({
      where: { isSelected: true },
    });
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
  async synchronizeResources() {
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
