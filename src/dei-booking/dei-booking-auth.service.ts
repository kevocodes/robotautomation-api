import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { ConfigType } from '@nestjs/config';
import envConfig from '../config/environment/env.config';
import {
  CachedDeiBookingSession,
  DeiBookingAuthResponse,
  DeiBookingSession,
} from './dei-booking.types';
import {
  DEI_BOOKING_DEFAULT_TIMEOUT,
  DEI_BOOKING_EXPIRATION_BUFFER_SECONDS,
  DEI_BOOKING_SESSION_CACHE_KEY,
} from './dei-booking.constants';

const REQUEST_TIMEOUT_MS = DEI_BOOKING_DEFAULT_TIMEOUT;

@Injectable()
export class DeiBookingAuthService {
  private readonly logger = new Logger(DeiBookingAuthService.name);
  private readonly authClient: AxiosInstance;
  private ongoingRefresh: Promise<DeiBookingSession> | null = null;

  constructor(
    @Inject(envConfig.KEY)
    private readonly env: ConfigType<typeof envConfig>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.authClient = axios.create({
      baseURL: this.env.deiBooking.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
    });
  }

  async getSession(): Promise<DeiBookingSession> {
    const cached = await this.getCachedSession();
    if (cached && !this.isExpired(cached)) {
      return cached;
    }

    return this.refreshSession();
  }

  async getSessionToken(): Promise<string> {
    const session = await this.getSession();
    return session.token;
  }

  async invalidateSession(): Promise<void> {
    await this.cacheManager.del(DEI_BOOKING_SESSION_CACHE_KEY);
    this.ongoingRefresh = null;
  }

  private async refreshSession(): Promise<DeiBookingSession> {
    if (!this.ongoingRefresh) {
      this.ongoingRefresh = this.requestNewSession().finally(() => {
        this.ongoingRefresh = null;
      });
    }

    return this.ongoingRefresh;
  }

  private async requestNewSession(): Promise<DeiBookingSession> {
    try {
      const payload = {
        username: this.env.deiBooking.username,
        password: this.env.deiBooking.password,
      };

      const { data } = await this.authClient.post<DeiBookingAuthResponse>(
        this.env.deiBooking.authPath,
        payload,
      );

      if (!data?.sessionToken) {
        throw new Error(
          'DEI Booking authentication did not return a session token',
        );
      }

      const expiresAt = this.resolveExpirationDate(data.sessionExpires);
      const session: DeiBookingSession = {
        token: data.sessionToken,
        userId: data.userId ?? this.env.deiBooking.identifier,
        expiresAt,
      };

      await this.cacheSession(session);
      return session;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Failed to obtain DEI Booking session token: ${axiosError.message}`,
        axiosError.stack,
      );
      throw error;
    }
  }

  private async getCachedSession(): Promise<DeiBookingSession | null> {
    const cached = await this.cacheManager.get<CachedDeiBookingSession>(
      DEI_BOOKING_SESSION_CACHE_KEY,
    );
    if (!cached) {
      return null;
    }

    return {
      token: cached.token,
      userId: cached.userId,
      expiresAt: new Date(cached.expiresAtIso),
    };
  }

  private async cacheSession(session: DeiBookingSession): Promise<void> {
    const ttl = this.computeCacheTtlSeconds(session.expiresAt);
    const value: CachedDeiBookingSession = {
      token: session.token,
      userId: session.userId,
      expiresAtIso: session.expiresAt.toISOString(),
    };

    await this.cacheManager.set(DEI_BOOKING_SESSION_CACHE_KEY, value, ttl);
  }

  private computeCacheTtlSeconds(expirationDate: Date): number {
    const msUntilExpiry = expirationDate.getTime() - Date.now();
    const secondsUntilExpiry = Math.floor(msUntilExpiry / 1000);
    const configuredTtl = Math.max(
      this.env.deiBooking.tokenExpiration -
        DEI_BOOKING_EXPIRATION_BUFFER_SECONDS,
      1,
    );

    if (Number.isNaN(secondsUntilExpiry) || secondsUntilExpiry <= 0) {
      return configuredTtl;
    }

    const effectiveSeconds =
      secondsUntilExpiry - DEI_BOOKING_EXPIRATION_BUFFER_SECONDS;

    if (effectiveSeconds <= 0) {
      return Math.max(1, configuredTtl);
    }

    return Math.max(1, Math.min(effectiveSeconds, configuredTtl));
  }

  private isExpired(session: DeiBookingSession): boolean {
    const now = Date.now();
    const expiresInMs =
      session.expiresAt.getTime() -
      DEI_BOOKING_EXPIRATION_BUFFER_SECONDS * 1000;
    return expiresInMs <= now;
  }

  private resolveExpirationDate(sessionExpires?: string): Date {
    if (sessionExpires) {
      const expires = new Date(sessionExpires);
      if (!Number.isNaN(expires.getTime())) {
        return expires;
      }
    }

    return new Date(Date.now() + this.env.deiBooking.tokenExpiration * 1000);
  }
}
