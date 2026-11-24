import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { RetrievalController } from './retrieval.controller.js';
import { RetrievalService } from './retrieval.service.js';

@Module({
  imports: [EmbeddingsModule],
  controllers: [RetrievalController],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
