import { MailerService } from '@nestjs-modules/mailer';
import { ApiResponse } from 'src/common/types/response.type';
import { ContactUsDto } from './dtos/contact-us.dto';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import envConfig from 'src/config/environment/env.config';
import * as dayjs from 'dayjs';
import { ReservationCleaningEvent } from 'src/reservations/dtos/reservationCleaningEvent';
@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    @Inject(envConfig.KEY)
    private readonly configService: ConfigType<typeof envConfig>,
  ) {}

  async sendContactUsEmail(data: ContactUsDto): Promise<ApiResponse> {
    await this.mailerService.sendMail({
      to: this.configService.smtp.contactUsEmail,
      subject: '¡Nueva solicitud de contacto recibida!',
      template: 'contact-us',
      context: {
        name: data.name,
        lastname: data.lastname,
        email: data.email,
        message: data.message,
        phoneNumber: data.phoneNumber,
      },
    });

    return {
      statusCode: 200,
      message: 'Email sent successfully',
      data: null,
    };
  }

  async sendVerificationEmail(
    name: string,
    email: string,
    otp: string,
    expiresAt: string,
  ) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Verifica tu cuenta',
      template: 'verify-email',
      context: {
        otp,
        name,
        expiresAt,
      },
    });
  }

  async sendForgotPasswordEmail(
    name: string,
    email: string,
    expiresAt: string,
    token: string,
  ) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Recupera tu contraseña',
      template: 'forgot-password',
      context: {
        expiresAt: dayjs(expiresAt).format('DD/MM/YYYY HH:mm:ss'),
        token,
        name,
        forgotPage: this.configService.forgotPassword.page,
      },
    });
  }

  async sendCleaningStartedEmail(
    recipients: string[],
    event: ReservationCleaningEvent,
    cleaningDurationMinutes: number,
  ): Promise<void> {
    if (!recipients.length) {
      return;
    }

    await this.mailerService.sendMail({
      to: recipients,
      subject: `Limpieza iniciada en ${event.resourceName}`,
      template: 'cleaning-started',
      context: {
        resourceName: event.resourceName,
        reservationReferenceNumber: event.reservationReferenceNumber,
        startTime: dayjs(event.startDate).format('DD/MM/YYYY HH:mm:ss'),
        durationMinutes: cleaningDurationMinutes,
      },
    });
  }
}
