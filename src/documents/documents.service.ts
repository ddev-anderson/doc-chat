import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  constructor(
    @InjectRepository(Document)
    private readonly documentsRepository: Repository<Document>,
  ) {}

  async ingest(file: Express.Multer.File): Promise<DocumentResponse> {
    const filename = file.originalname.replace(/^.*[\\/]/, '').trim();

    if (!filename) {
      throw new BadRequestException('The uploaded file must have a name.');
    }

    const { text, mimeType } = extractText(file);

    const document = await this.documentsRepository.save(
      this.documentsRepository.create({
        filename,
        mimeType,
        content: text,
      }),
    );

    return {
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      characters: text.length,
      chunks: 0,
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
