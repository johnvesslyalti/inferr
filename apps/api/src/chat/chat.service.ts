import { Injectable } from '@nestjs/common';
import { AgenticRagService } from './agentic-rag.service';
import type {
  GraphHistoryMessage,
  ChatSource,
  ChatResult,
} from './dto/chat.dto';

// Re-export for any existing consumers of the chat service contract
export type { ChatSource, ChatResult, GraphHistoryMessage };

@Injectable()
export class ChatService {
  constructor(private readonly agenticRag: AgenticRagService) {}

  async query(
    userId: string,
    question: string,
    history: GraphHistoryMessage[] = [],
  ): Promise<ChatResult> {
    // Delegate to the LangGraph-powered agentic RAG implementation.
    // This provides retrieval grading, query rewriting loops, and conversation-aware generation.
    // Note: personalization via user interests/tags is deliberately NOT applied here
    // (see AgenticRagService for rationale; feed uses it).
    return this.agenticRag.query(userId, question, history);
  }
}
