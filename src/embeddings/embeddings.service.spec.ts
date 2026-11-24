import {
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { APIConnectionError } from 'openai';
import type OpenAI from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingsService } from './embeddings.service.js';

function createConfig(values: Record<string, unknown>): ConfigService {
  return {
    getOrThrow: vi.fn((key: string) => {
      if (!(key in values)) {
        throw new Error(`Unexpected key: ${key}`);
      }
      return values[key];
    }),
  } as unknown as ConfigService;
}

describe('EmbeddingsService', () => {
  let create: ReturnType<typeof vi.fn>;
  let client: OpenAI;
  let service: EmbeddingsService;

  beforeEach(() => {
    create = vi.fn();
    client = { embeddings: { create } } as unknown as OpenAI;
    service = new EmbeddingsService(
      client,
      createConfig({
        EMBEDDINGS_MODEL: 'bge-m3',
        EMBEDDINGS_DIMENSION: 3,
        EMBEDDINGS_BATCH_SIZE: 2,
      }),
    );
  });

  it('batches inputs and preserves order', async () => {
    create.mockImplementation(async ({ input }: { input: string[] }) => ({
      data: input
        .map((_text, index) => ({
          index,
          embedding: [index, index, index],
        }))
        .reverse(),
    }));

    const result = await service.embedDocuments(['a', 'b', 'c', 'd', 'e']);

    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls[0][0].input).toEqual(['a', 'b']);
    expect(create.mock.calls[1][0].input).toEqual(['c', 'd']);
    expect(create.mock.calls[2][0].input).toEqual(['e']);
    expect(result).toEqual([
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ]);
  });

  it('returns no vectors for empty input', async () => {
    await expect(service.embedDocuments([])).resolves.toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns a single vector for a query', async () => {
    create.mockResolvedValue({
      data: [{ index: 0, embedding: [1, 2, 3] }],
    });

    await expect(service.embedQuery('pergunta')).resolves.toEqual([1, 2, 3]);
  });

  it('rejects vectors with the wrong dimension', async () => {
    create.mockResolvedValue({
      data: [{ index: 0, embedding: [1, 2] }],
    });

    await expect(service.embedDocuments(['texto'])).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('maps connection failures to 503', async () => {
    create.mockRejectedValue(
      new APIConnectionError({ message: 'connection refused' }),
    );

    await expect(service.embedDocuments(['texto'])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
