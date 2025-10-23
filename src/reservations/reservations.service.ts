import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { DeiBookingHttpService } from 'src/dei-booking/dei-booking-http.service';
import { ReservationDeiResponse } from './dtos/reservationsDeiResponse';
import { FindAllReservationsQueryDto } from './dtos/findAllReservationsQuery';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);
  private readonly reservationsPath = '/Reservations/';

  constructor(private readonly deiBookingApi: DeiBookingHttpService) {}

  async getAllReservations(
    query: FindAllReservationsQueryDto,
  ): Promise<ReservationDeiResponse[]> {
    try {
      const response = await this.deiBookingApi.get<ReservationDeiResponse[]>(
        this.reservationsPath,
        { params: query },
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;

      const errorMessage =
        axiosError.response?.data?.message ??
        axiosError.message ??
        'Unknown error while fetching reservations';
      this.logger.error(
        `DEI Booking reservations request failed: ${errorMessage}`,
      );

      throw new BadGatewayException(
        'No fue posible obtener las reservaciones desde DEI Booking',
      );
    }
  }
}
