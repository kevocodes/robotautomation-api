import { Module } from '@nestjs/common';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { join } from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import envConfig from 'src/config/environment/env.config';
import { ConfigType } from '@nestjs/config';

console.log('TEMPLATES DIR ->', join(__dirname, 'templates'));

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [envConfig.KEY],
      useFactory: (configService: ConfigType<typeof envConfig>) => ({
        transport: {
          host: configService.smtp.host,
          port: configService.smtp.port,
          secure: configService.smtp.secure,
          auth: {
            user: configService.smtp.auth.user,
            pass: configService.smtp.auth.pass,
          },
        },
        defaults: {
          from: configService.smtp.defaults.from,
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
    }),
  ],
  providers: [MailService],
  controllers: [MailController],
  exports: [MailService],
})
export class MailModule {}
