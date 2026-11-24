import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { Chunk } from './entities/chunk.entity.js';
import { Document } from './entities/document.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Document, Chunk]), EmbeddingsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
