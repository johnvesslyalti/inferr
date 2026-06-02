import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AgenticRagService } from './agentic-rag.service';

@Module({
  imports: [AiModule, AuthModule],
  providers: [ChatService, AgenticRagService],
  controllers: [ChatController],
  exports: [AgenticRagService],
})
export class ChatModule {}
