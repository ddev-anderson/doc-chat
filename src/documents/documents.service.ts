import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { chunkText } from './chunking.js';
import { Chunk } from './entities/chunk.entity.js';
import { Document } from './entities/document.entity.js';
import { extractText } from './text-extraction.js';

export interface DocumentResponse {
  id: string;
  filename: string;
  mimeType: string;
  characters: number;
  chunks: number;
  createdAt: Date;
}

export interface DocumentSummary {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: Date;
}

@Injectable()
export class DocumentsService {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
    private readonly embeddingsService: EmbeddingsService,
    config: ConfigService,
  ) {
    this.chunkSize = config.getOrThrow<number>('CHUNK_SIZE');
    this.chunkOverlap = config.getOrThrow<number>('CHUNK_OVERLAP');
  }

  async ingest(file: Express.Multer.File): Promise<DocumentResponse> {
    const filename = file.originalname.replace(/^.*[\\/]/, '').trim();

    if (!filename) {
      throw new BadRequestException('The uploaded file must have a name.');
    }

    const { text, mimeType } = extractText(file);

    const chunks = chunkText(text, {
      maxCharacters: this.chunkSize,
      overlapCharacters: this.chunkOverlap,
    });

    const embeddings = await this.embeddingsService.embedDocuments(chunks);

    const document = await this.documentsRepository.manager.transaction(
      async (manager) => {
        const saved = await manager.save(
          manager.create(Document, {
            filename,
            mimeType,
            content: text,
          }),
        );

        const chunkEntities = chunks.map((content, index) =>
          manager.create(Chunk, {
            documentId: saved.id,
            chunkIndex: index,
            content,
            embedding: embeddings[index],
          }),
        );

        await manager.save(chunkEntities);

        return saved;
      },
    );

    return {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      characters: text.length,
      chunks: chunks.length,
      createdAt: document.createdAt,
    };
  }

  async findAll(): Promise<DocumentSummary[]> {
    const documents = await this.documentsRepository.find({
      select: {
        id: true,
        filename: true,
        mimeType: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
    });

    return documents.map((document) => ({
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      createdAt: document.createdAt,
    }));
  }
}
