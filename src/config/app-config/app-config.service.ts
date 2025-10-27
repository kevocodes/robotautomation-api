// ./src/config/config.service.ts

import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalConfig } from '@prisma/client';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { UpdateAppConfigDto } from './dtos/update-app-config.dto';

const GLOBAL_CONFIG_KEY = 'GLOBAL'; // La clave única de nuestro documento
const CACHE_KEY = 'GLOBAL_CONFIG'; // La clave para guardar en caché

@Injectable()
export class AppConfigService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Se ejecuta cuando el módulo se inicializa.
   * Asegura que el documento de configuración exista en la DB
   * y lo carga en el caché por primera vez.
   */
  async onModuleInit() {
    await this.ensureConfigExists();
    await this.loadConfigToCache();
  }

  /**
   * Asegura que el documento de configuración exista.
   * Si no existe, lo crea. Prisma aplicará los @default
   * definidos en 'schema.prisma' automáticamente.
   */
  private async ensureConfigExists() {
    await this.prisma.globalConfig.upsert({
      where: { key: GLOBAL_CONFIG_KEY },
      update: {}, // No hacer nada si ya existe
      create: {
        key: GLOBAL_CONFIG_KEY,
        // Los valores por defecto se tomarán automáticamente de 'schema.prisma'.
      },
    });
  }

  /**
   * Obtiene la configuración desde la base de datos
   * y la guarda en el caché.
   */
  private async loadConfigToCache(): Promise<GlobalConfig> {
    const config = await this.prisma.globalConfig.findUnique({
      where: { key: GLOBAL_CONFIG_KEY },
    });

    if (config) {
      await this.cacheManager.set(CACHE_KEY, config);
    }
    return config;
  }

  /**
   * Obtiene la configuración global.
   * Intenta leerla desde el caché primero. Si no está,
   * la busca en la DB y la guarda en caché.
   */
  async getSettings(): Promise<GlobalConfig> {
    const cachedConfig = await this.cacheManager.get<GlobalConfig>(CACHE_KEY);

    if (cachedConfig) {
      return cachedConfig;
    }

    // Si no está en caché, la carga de la DB y la guarda
    return this.loadConfigToCache();
  }

  /**
   * Actualiza la configuración global.
   * Recibe datos parciales (DTO) para actualizar.
   * Después de actualizar la DB, invalida (actualiza) el caché.
   */
  async updateSettings(
    // Deberías crear un DTO para validar esto
    data: UpdateAppConfigDto,
  ): Promise<GlobalConfig> {
    const updatedConfig = await this.prisma.globalConfig.update({
      where: { key: GLOBAL_CONFIG_KEY },
      data: data,
    });

    // ¡Importante! Actualizar el caché con los nuevos datos.
    await this.cacheManager.set(CACHE_KEY, updatedConfig);

    return updatedConfig;
  }
}
