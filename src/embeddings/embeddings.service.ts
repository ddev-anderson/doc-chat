import {
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from 'openai';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly model: string;
  private readonly dimension: number;
  private readonly batchSize: number;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
    config: ConfigService,
  ) {
    this.model = config.getOrThrow<string>('EMBEDDINGS_MODEL');
    this.dimension = config.getOrThrow<number>('EMBEDDINGS_DIMENSION');
    this.batchSize = config.getOrThrow<number>('EMBEDDINGS_BATCH_SIZE');
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];

    for (let start = 0; start < texts.length; start += this.batchSize) {
      const batch = texts.slice(start, start + this.batchSize);
      embeddings.push(...(await this.embedBatch(batch)));
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    return embedding;
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      });

      const embeddings = response.data
        .toSorted((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      if (embeddings.length !== texts.length) {
        throw new BadGatewayException(
          'Embedding provider returned an unexpected number of vectors.',
        );
      }

      for (const embedding of embeddings) {
        if (embedding.length !== this.dimension) {
          throw new InternalServerErrorException(
            `Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}. Check EMBEDDINGS_MODEL and EMBEDDINGS_DIMENSION.`,
          );
        }
      }

      return embeddings;
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof APIConnectionTimeoutError) {
      throw new GatewayTimeoutException('Embedding provider timed out.');
    }

    if (error instanceof APIConnectionError) {
      throw new ServiceUnavailableException(
        'Embedding provider is unavailable.',
      );
    }

    if (error instanceof APIError) {
      this.logger.error(
        `Embedding provider error: ${error.status ?? 'unknown'} ${error.message}`,
      );
      throw new BadGatewayException('Embedding provider returned an error.');
    }

    throw error;
  }
}
