import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { isNull } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { articles } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI;

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async summarize(title: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a technical content summarizer for software developers. Given an article title, write exactly 3 sentences that capture what the article is likely about, why it matters to developers, and what they might learn. Be concise and technical.',
        },
        { role: 'user', content: `Article title: "${title}"` },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    return response.choices[0].message.content?.trim() ?? '';
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  }

  async processUnsummarized(
    limit = 30,
  ): Promise<{ processed: number; failed: number }> {
    const unsummarized = await this.db
      .select({ id: articles.id, title: articles.title })
      .from(articles)
      .where(isNull(articles.summary))
      .limit(limit);

    this.logger.log(`Found ${unsummarized.length} unsummarized articles`);

    let processed = 0;
    let failed = 0;

    for (const article of unsummarized) {
      try {
        const summary = await this.summarize(article.title);
        const embedding = await this.embed(summary);

        await this.db
          .update(articles)
          .set({ summary, embedding })
          .where(eq(articles.id, article.id));

        processed++;
        this.logger.log(
          `Processed [${processed}/${unsummarized.length}]: ${article.title}`,
        );
      } catch (err) {
        failed++;
        this.logger.error(`Failed to process article ${article.id}: ${err}`);
      }
    }

    return { processed, failed };
  }
}
