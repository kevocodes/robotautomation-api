import {
  HttpStatus,
  ParseFilePipe,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { megBytesToBytes } from './bytes-to-mb';

interface ParseImagePipeOptions {
  required?: boolean;
  maxSize?: number;
}

export function getParseImagePipe({
  required = true,
  maxSize = 4.1,
}: ParseImagePipeOptions = {}): ParseFilePipe {
  return new ParseFilePipeBuilder()
    .addFileTypeValidator({
      fileType: '.(png|jpeg|jpg|webp)',
    })
    .addMaxSizeValidator({
      maxSize: megBytesToBytes(maxSize),
      message: `File size must be less than ${maxSize} MB`,
    })
    .build({
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      fileIsRequired: required,
    });
}
