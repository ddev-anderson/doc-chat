import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ChatDto } from './chat.dto.js';
import { ChatService, type ChatResponse } from './chat.service.js';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  ask(@Body() dto: ChatDto): Promise<ChatResponse> {
    return this.chatService.ask(dto.question, dto.topK, dto.minScore);
  }
}
