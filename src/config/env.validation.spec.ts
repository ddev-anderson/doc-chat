import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

const validEnv: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'rag',
  DB_PASSWORD: 'rag',
  DB_NAME: 'rag',
  CHUNK_SIZE: '1200',
  CHUNK_OVERLAP: '150',
  EMBEDDINGS_BASE_URL: 'http://127.0.0.1:11434/v1',
  EMBEDDINGS_MODEL: 'bge-m3',
  EMBEDDINGS_DIMENSION: '1024',
  EMBEDDINGS_BATCH_SIZE: '16',
  EMBEDDINGS_TIMEOUT_MS: '60000',
  EMBEDDINGS_MAX_RETRIES: '0',
  RETRIEVAL_TOP_K: '5',
  RETRIEVAL_MIN_SCORE: '0.5',
  LLM_API_KEY: 'test-key',
  LLM_BASE_URL: 'https://api.deepseek.com',
  LLM_MODEL: 'deepseek-flash',
  LLM_TIMEOUT_MS: '60000',
  LLM_MAX_RETRIES: '0',
  LLM_MAX_OUTPUT_TOKENS: '1024',
  LLM_TEMPERATURE: '0.1',
};

describe('validateEnv', () => {
  it('accepts a valid environment and converts numeric values', () => {
    const value = validateEnv(validEnv);

    expect(value.PORT).toBe(3000);
    expect(value.DB_PORT).toBe(5432);
    expect(value.EMBEDDINGS_DIMENSION).toBe(1024);
  });

  it('rejects a missing required variable', () => {
    const env = { ...validEnv };
    delete env.DB_PASSWORD;

    expect(() => validateEnv(env)).toThrow('DB_PASSWORD');
  });

  it('rejects an invalid port', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'not-a-port' })).toThrow();
  });

  it('rejects an overlap greater than or equal to the chunk size', () => {
    expect(() =>
      validateEnv({ ...validEnv, CHUNK_SIZE: '100', CHUNK_OVERLAP: '100' }),
    ).toThrow();
  });

  it('allows an empty LLM key so other endpoints can boot without chat', () => {
    const value = validateEnv({ ...validEnv, LLM_API_KEY: '' });

    expect(value.LLM_API_KEY).toBe('');
  });
});
