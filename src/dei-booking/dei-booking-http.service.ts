import { Inject, Injectable } from '@nestjs/common';
import axios, {
  AxiosHeaders,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { ConfigType } from '@nestjs/config';
import envConfig from '../config/environment/env.config';
import { DeiBookingAuthService } from './dei-booking-auth.service';
import { DEI_BOOKING_DEFAULT_TIMEOUT } from './dei-booking.constants';

@Injectable()
export class DeiBookingHttpService {
  private readonly client: AxiosInstance;

  constructor(
    private readonly authService: DeiBookingAuthService,
    @Inject(envConfig.KEY)
    private readonly env: ConfigType<typeof envConfig>,
  ) {
    this.client = axios.create({
      baseURL: this.env.deiBooking.apiUrl,
      timeout: DEI_BOOKING_DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(async (config) => {
      const session = await this.authService.getSession();
      const headers =
        config.headers instanceof AxiosHeaders
          ? config.headers
          : new AxiosHeaders(config.headers);
      headers.set('sessionToken', session.token);
      headers.set('userID', session.userId);
      config.headers = headers;
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          await this.authService.invalidateSession();
        }
        return Promise.reject(error);
      },
    );
  }

  get axiosRef(): AxiosInstance {
    return this.client;
  }

  get<T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  delete<T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.request<T>(config);
  }

  async withFreshSession<T>(
    handler: (client: AxiosInstance) => Promise<T>,
  ): Promise<T> {
    await this.authService.invalidateSession();
    await this.authService.getSession();
    return handler(this.client);
  }
}
