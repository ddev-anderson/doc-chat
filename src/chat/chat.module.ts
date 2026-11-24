import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { RetrievalModule } from '../retrieval/retrieval.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { LlmService, OPENAI_LLM_CLIENT } from './llm.service.js';

@Module({
  imports: [RetrievalModule],
  controllers: [ChatController],
  providers: [
    {
      provide: OPENAI_LLM_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAI({
          apiKey: config.get<string>('LLM_API_KEY')?.trim() || 'not-configured',
          baseURL: config.getOrThrow<string>('LLM_BASE_URL'),
          timeout: config.getOrThrow<number>('LLM_TIMEOUT_MS'),
          maxRetries: config.getOrThrow<number>('LLM_MAX_RETRIES'),
        }),
    },
    LlmService,
    ChatService,
  ],
})
export class ChatModule {}
