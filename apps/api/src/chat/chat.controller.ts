import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { GoogleTokenGuard } from '../auth/google-token.guard';
import { ChatService } from './chat.service';
import type { User } from '../db/schema';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UseGuards(GoogleTokenGuard)
  async chat(@Req() req: Request, @Body() body: { message: string }) {
    const user = req.user as User;
    return this.chatService.query(user.id, body.message);
  }
}
