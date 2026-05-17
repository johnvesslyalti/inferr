import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { AiService } from '../ai/ai.service';

export interface ChatSource {
  title: string;
  url: string;
  source: string;
}

export interface ChatResult {
  answer: string;
  sources: ChatSource[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly client: OpenAI;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly aiService: AiService,
  ) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async query(userId: string, question: string): Promise<ChatResult> {
    this.logger.log(`Chat query from user ${userId}: "${question}"`);

    const embedding = await this.aiService.embed(question);
    const embeddingStr = `[${embedding.join(',')}]`;

    const rows = await this.db.execute<{
      id: string;
      title: string;
      url: string;
      source: string;
      summary: string | null;
    }>(
      sql`
        SELECT id, title, url, source, summary
        FROM articles
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT 3
      `,
    );

    const contextArticles = rows.rows;

    const context = contextArticles
      .map((a, i) => `[${i + 1}] ${a.title}\nSummary: ${a.summary ?? 'No summary available.'}\nURL: ${a.url}`)
      .join('\n\n');

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant for software developers. Answer questions using only the provided article context. Be concise and technical. If the context does not contain enough information to answer, say so.',
        },
        {
          role: 'user',
          content: `Context articles:\n\n${context}\n\nQuestion: ${question}`,
        },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    const answer = response.choices[0].message.content?.trim() ?? '';

    return {
      answer,
      sources: contextArticles.map((a) => ({
        title: a.title,
        url: a.url,
        source: a.source,
      })),
    };
  }
}
