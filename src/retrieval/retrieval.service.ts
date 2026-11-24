import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';

export interface RetrievalResult {
  chunkId: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  score: number;
}

interface RetrievedChunkRow {
  chunkId: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  score: number;
}

@Injectable()
export class RetrievalService {
  private readonly defaultTopK: number;
  private readonly defaultMinScore: number;

  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.defaultTopK = config.getOrThrow<number>('RETRIEVAL_TOP_K');
    this.defaultMinScore = config.getOrThrow<number>('RETRIEVAL_MIN_SCORE');
  }

  async search(
    query: string,
    topK?: number,
    minScore?: number,
  ): Promise<RetrievalResult[]> {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length === 0) {
      throw new BadRequestException('query must not be empty.');
    }

    const limit = topK ?? this.defaultTopK;
    const threshold = minScore ?? this.defaultMinScore;

    const queryEmbedding =
      await this.embeddingsService.embedQuery(normalizedQuery);
    const vector = `[${queryEmbedding.join(',')}]`;

    const rows = (await this.dataSource.query(
      `
        SELECT
          c.id AS "chunkId",
          c.document_id AS "documentId",
          d.filename AS "filename",
          c.chunk_index AS "chunkIndex",
          c.content AS "content",
          1 - (c.embedding <=> $1::vector) AS "score"
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        ORDER BY c.embedding <=> $1::vector
        LIMIT $2
      `,
      [vector, limit],
    )) as RetrievedChunkRow[];

    return rows
      .map((row) => ({
        ...row,
        score: Number(row.score),
      }))
      .filter((row) => row.score >= threshold);
  }
}
