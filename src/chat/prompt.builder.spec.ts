import { describe, expect, it } from 'vitest';
import type { RetrievalResult } from '../retrieval/retrieval.service.js';
import {
  buildRagPrompt,
  INSUFFICIENT_CONTEXT_ANSWER,
} from './prompt.builder.js';

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

describe('buildRagPrompt', () => {
  it('numbers context chunks and includes the question', () => {
    const prompt = buildRagPrompt('Como funciona?', chunks);

    expect(prompt.user).toContain('[1] (arquivo: outbox.txt, trecho 0)');
    expect(prompt.user).toContain('[2] (arquivo: outbox.txt, trecho 1)');
    expect(prompt.user).toContain('PERGUNTA: Como funciona?');
  });

  it('includes grounding, citation and data-boundary rules', () => {
    const prompt = buildRagPrompt('q', chunks);

    expect(prompt.system).toContain(INSUFFICIENT_CONTEXT_ANSWER);
    expect(prompt.system).toContain('[1], [2]');
    expect(prompt.system).toContain('dados');
    expect(prompt.system).toContain('Não use conhecimento externo');
  });
});
