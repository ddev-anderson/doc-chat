import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { APIConnectionError } from 'openai';
import type OpenAI from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmService } from './llm.service.js';

function createConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    LLM_MODEL: 'deepseek-flash',
    LLM_TEMPERATURE: 0.1,
    LLM_MAX_OUTPUT_TOKENS: 1024,
    LLM_API_KEY: 'test-key',
    ...overrides,
  };

  return {
    getOrThrow: vi.fn((key: string) => values[key]),
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('LlmService', () => {
  let create: ReturnType<typeof vi.fn>;
  let client: OpenAI;
  let service: LlmService;

  beforeEach(() => {
    create = vi.fn();
    client = {
      chat: { completions: { create } },
    } as unknown as OpenAI;
    service = new LlmService(client, createConfig());
  });

  it('calls the provider and maps the response and usage', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'Resposta [1].' } }],
      usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
    });

    const result = await service.generate('system', 'user');

    expect(create).toHaveBeenCalledWith({
      model: 'deepseek-flash',
      messages: [
        { role: 'system', content: 'system' },
        { role: 'user', content: 'user' },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });
    expect(result).toEqual({
      answer: 'Resposta [1].',
      usage: { inputTokens: 120, outputTokens: 30 },
    });
  });

  it('refuses to call the provider when the key is not configured', async () => {
    const notConfigured = new LlmService(
      client,
      createConfig({ LLM_API_KEY: 'replace-me' }),
    );

    await expect(
      notConfigured.generate('system', 'user'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an empty answer', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: '   ' } }],
    });

    await expect(service.generate('system', 'user')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps connection failures to 503', async () => {
    create.mockRejectedValue(
      new APIConnectionError({ message: 'connection refused' }),
    );

    await expect(service.generate('system', 'user')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
