import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { ApiResponse } from 'src/common/types/response.type';
import { ContactUsDto } from './dtos/contact-us.dto';

@ApiTags('mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('contact-us')
  async contactUs(@Body() body: ContactUsDto): Promise<ApiResponse> {
    return await this.mailService.sendContactUsEmail(body);
  }
}
