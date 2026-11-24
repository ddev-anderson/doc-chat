import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from 'openai';

export const OPENAI_LLM_CLIENT = Symbol('OPENAI_LLM_CLIENT');

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResult {
  answer: string;
  usage?: LlmUsage;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;
  private readonly configured: boolean;

  constructor(
    @Inject(OPENAI_LLM_CLIENT) private readonly client: OpenAI,
    config: ConfigService,
  ) {
    this.model = config.getOrThrow<string>('LLM_MODEL');
    this.temperature = config.getOrThrow<number>('LLM_TEMPERATURE');
    this.maxOutputTokens = config.getOrThrow<number>('LLM_MAX_OUTPUT_TOKENS');

    const apiKey = config.get<string>('LLM_API_KEY')?.trim() ?? '';
    this.configured = apiKey.length > 0 && apiKey !== 'replace-me';
  }

  async generate(system: string, user: string): Promise<LlmResult> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'LLM provider is not configured. Set LLM_API_KEY in .env.',
      );
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: this.temperature,
        max_tokens: this.maxOutputTokens,
      });

      const answer = response.choices[0]?.message?.content?.trim();

      if (!answer) {
        throw new BadGatewayException('LLM returned an empty answer.');
      }

      return {
        answer,
        usage: response.usage
          ? {
              inputTokens: response.usage.prompt_tokens,
              outputTokens: response.usage.completion_tokens,
            }
          : undefined,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (error instanceof APIConnectionTimeoutError) {
      throw new GatewayTimeoutException('LLM provider timed out.');
    }

    if (error instanceof APIConnectionError) {
      throw new ServiceUnavailableException('LLM provider is unavailable.');
    }

    if (error instanceof APIError) {
      this.logger.error(
        `LLM provider error: ${error.status ?? 'unknown'} ${error.message}`,
      );
      throw new BadGatewayException('LLM provider returned an error.');
    }

    throw error;
  }
}
