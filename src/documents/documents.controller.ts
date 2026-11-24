import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  DocumentsService,
  type DocumentResponse,
  type DocumentSummary,
} from './documents.service.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  ingest(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DocumentResponse> {
    if (!file) {
      throw new BadRequestException('The multipart field "file" is required.');
    }

    return this.documentsService.ingest(file);
  }

  @Get()
  findAll(): Promise<DocumentSummary[]> {
    return this.documentsService.findAll();
  }
}
