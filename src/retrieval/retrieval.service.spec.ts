import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { RetrievalService } from './retrieval.service.js';

function createService(options?: { topK?: number; minScore?: number }) {
  const embedQuery = vi.fn(async () => [0.1, 0.2]);
  const query = vi.fn();
  const config = {
    getOrThrow: vi.fn((key: string) => {
      if (key === 'RETRIEVAL_TOP_K') {
        return options?.topK ?? 5;
      }
      if (key === 'RETRIEVAL_MIN_SCORE') {
        return options?.minScore ?? 0;
      }
      throw new Error(`Unexpected key: ${key}`);
    }),
  } as unknown as ConfigService;

  const service = new RetrievalService(
    { embedQuery } as unknown as EmbeddingsService,
    { query } as unknown as DataSource,
    config,
  );

  return { service, embedQuery, query };
}

const rows = [
  {
    chunkId: 'c1',
    documentId: 'd1',
    filename: 'outbox.txt',
    chunkIndex: 0,
    content: 'O padrão Outbox...',
    score: 0.82,
  },
  {
    chunkId: 'c2',
    documentId: 'd2',
    filename: 'outro.txt',
    chunkIndex: 1,
    content: 'Outro conteúdo...',
    score: 0.55,
  },
];

describe('RetrievalService', () => {
  it('generates the query vector and searches with top-k', async () => {
    const { service, embedQuery, query } = createService();
    query.mockResolvedValue(rows);

    const results = await service.search('  como funciona?  ');

    expect(embedQuery).toHaveBeenCalledWith('como funciona?');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('<=>');
    expect(query.mock.calls[0][1]).toEqual(['[0.1,0.2]', 5]);
    expect(results).toEqual(rows);
  });

  it('filters results by minScore', async () => {
    const { service, query } = createService({ minScore: 0.6 });
    query.mockResolvedValue(rows);

    const results = await service.search('outbox');

    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.82);
  });

  it('accepts topK and minScore overrides', async () => {
    const { service, query } = createService();
    query.mockResolvedValue(rows);

    const results = await service.search('outbox', 2, 0.8);

    expect(query.mock.calls[0][1]).toEqual(['[0.1,0.2]', 2]);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.82);
  });

  it('rejects an empty query before calling the provider', async () => {
    const { service, embedQuery, query } = createService();

    await expect(service.search('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(embedQuery).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
