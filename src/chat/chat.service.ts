import { BadRequestException, Injectable } from '@nestjs/common';
import { RetrievalService } from '../retrieval/retrieval.service.js';
import { LlmService, type LlmUsage } from './llm.service.js';
import {
  buildRagPrompt,
  INSUFFICIENT_CONTEXT_ANSWER,
} from './prompt.builder.js';

export interface ChatSource {
  chunkId: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  usage?: LlmUsage;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly llmService: LlmService,
  ) {}

  async ask(
    question: string,
    topK?: number,
    minScore?: number,
  ): Promise<ChatResponse> {
    const normalizedQuestion = question.trim();

    if (normalizedQuestion.length === 0) {
      throw new BadRequestException('question must not be empty.');
    }

    const chunks = await this.retrievalService.search(
      normalizedQuestion,
      topK,
      minScore,
    );

    if (chunks.length === 0) {
      return {
        answer: INSUFFICIENT_CONTEXT_ANSWER,
        sources: [],
      };
    }

    const prompt = buildRagPrompt(normalizedQuestion, chunks);
    const { answer, usage } = await this.llmService.generate(
      prompt.system,
      prompt.user,
    );

    return {
      answer,
      sources: chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        filename: chunk.filename,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        score: chunk.score,
      })),
      usage,
    };
  }
}
