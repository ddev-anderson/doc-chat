import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RetrievalSearchDto } from './retrieval.dto.js';
import { RetrievalService, type RetrievalResult } from './retrieval.service.js';

export interface RetrievalResponse {
  query: string;
  results: RetrievalResult[];
}

@Controller('retrieval')
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: RetrievalSearchDto): Promise<RetrievalResponse> {
    const results = await this.retrievalService.search(
      dto.query,
      dto.topK,
      dto.minScore,
    );

    return { query: dto.query, results };
  }
}
