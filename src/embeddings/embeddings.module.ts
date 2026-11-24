import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EmbeddingsService, OPENAI_CLIENT } from './embeddings.service.js';

@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAI({
          // Ollama ignores the key, but the OpenAI SDK requires a non-empty value.
          apiKey: 'ollama',
          baseURL: config.getOrThrow<string>('EMBEDDINGS_BASE_URL'),
          timeout: config.getOrThrow<number>('EMBEDDINGS_TIMEOUT_MS'),
          maxRetries: config.getOrThrow<number>('EMBEDDINGS_MAX_RETRIES'),
        }),
    },
    EmbeddingsService,
  ],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
