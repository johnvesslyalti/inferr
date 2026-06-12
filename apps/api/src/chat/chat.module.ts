import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { AgenticRagService } from './agentic-rag.service';
import { EvaluationsModule } from '../evaluations/evaluations.module';

@Module({
  imports: [AiModule, AuthModule, EvaluationsModule],
  providers: [ChatService, AgenticRagService],
  controllers: [ChatController],
  exports: [AgenticRagService],
})
export class ChatModule {}
