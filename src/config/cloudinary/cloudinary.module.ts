import { Global, Module } from '@nestjs/common';
import { CloudinaryProvider } from './providers/cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';

@Global()
@Module({
  providers: [CloudinaryService, CloudinaryProvider],
  exports: [CloudinaryService, CloudinaryProvider],
})
export class CloudinaryModule {}
