import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RetrievalResult,
  RetrievalService,
} from '../retrieval/retrieval.service.js';
import { ChatService } from './chat.service.js';
import type { LlmService } from './llm.service.js';
import { INSUFFICIENT_CONTEXT_ANSWER } from './prompt.builder.js';

const chunks: RetrievalResult[] = [
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
    documentId: 'd1',
    filename: 'outbox.txt',
    chunkIndex: 1,
    content: 'Publisher...',
    score: 0.7,
  },
];

describe('ChatService', () => {
  let retrieval: { search: ReturnType<typeof vi.fn> };
  let llm: { generate: ReturnType<typeof vi.fn> };
  let service: ChatService;

  beforeEach(() => {
    retrieval = { search: vi.fn() };
    llm = { generate: vi.fn() };

    service = new ChatService(
      retrieval as unknown as RetrievalService,
      llm as unknown as LlmService,
    );
  });

  it('retrieves, prompts and returns the answer with structural sources', async () => {
    retrieval.search.mockResolvedValue(chunks);
    llm.generate.mockResolvedValue({
      answer: 'Resposta [1].',
      usage: { inputTokens: 100, outputTokens: 20 },
    });

    const result = await service.ask('Como funciona?', 3, 0.6);

    expect(retrieval.search).toHaveBeenCalledWith('Como funciona?', 3, 0.6);
    expect(llm.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('PERGUNTA: Como funciona?'),
    );
    expect(result.answer).toBe('Resposta [1].');
    expect(result.sources).toEqual([
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
        documentId: 'd1',
        filename: 'outbox.txt',
        chunkIndex: 1,
        content: 'Publisher...',
        score: 0.7,
      },
    ]);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
  });

  it('returns a fixed refusal without calling the LLM when nothing is retrieved', async () => {
    retrieval.search.mockResolvedValue([]);

    const result = await service.ask('Pergunta fora do corpus');

    expect(result).toEqual({
      answer: INSUFFICIENT_CONTEXT_ANSWER,
      sources: [],
    });
    expect(llm.generate).not.toHaveBeenCalled();
  });

  it('rejects an empty question before retrieval', async () => {
    await expect(service.ask('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(retrieval.search).not.toHaveBeenCalled();
  });
});
