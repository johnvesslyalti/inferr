import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import type { User } from '../db/schema';
import { ChatDto } from './dto/chat.dto';
import type { GraphHistoryMessage } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async chat(@Req() req: Request, @Body() body: ChatDto) {
    const user = req.user as User;

    // Convert validated DTO history (if any) to the internal shape expected by the graph.
    const history: GraphHistoryMessage[] = (body.history ?? []).map((h) => ({
      role: h.role,
      content: h.content,
    }));

    return this.chatService.query(user.id, body.message, history);
  }
}
