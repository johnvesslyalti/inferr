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

  async summarize(title: string, content?: string): Promise<string> {
    const hasContent = !!content && content.trim().length > 0;

    const system = hasContent
      ? 'You are a technical content summarizer for software developers. Given the full text of an article, write exactly 3 sentences: what the article covers, why it matters to developers, and one key takeaway. Be concise and technical. Summarize only what the text actually says — do not speculate.'
      : 'You are a technical content summarizer for software developers. Given an article title, write exactly 3 sentences that capture what the article is likely about, why it matters to developers, and what they might learn. Be concise and technical.';

    const user = hasContent
      ? `Article title: "${title}"\n\nArticle text:\n${content.slice(0, 4000)}`
      : `Article title: "${title}"`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 150,
      temperature: 0.3,
    });

    return response.choices[0]?.message.content?.trim() ?? '';
  }

  async chat(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.3,
    });
    return response.choices[0].message.content?.trim() ?? '';
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) throw new Error('OpenAI embeddings returned no data');
    return embedding;
  }

  async processUnsummarized(
    limit = 30,
  ): Promise<{ processed: number; failed: number }> {
    const unsummarized = await this.db
      .select({
        id: articles.id,
        title: articles.title,
        content: articles.content,
        tags: articles.tags,
      })
      .from(articles)
      .where(isNull(articles.summary))
      .limit(limit);

    this.logger.log(`Found ${unsummarized.length} unsummarized articles`);

    let processed = 0;
    let failed = 0;

    for (const article of unsummarized) {
      try {
        const summary = await this.summarize(
          article.title,
          article.content ?? undefined,
        );

        // Guard against empty string (e.g. OpenAI content filter returns null content).
        // Writing a placeholder prevents the article being re-queued on every scheduler run.
        if (!summary) {
          await this.db
            .update(articles)
            .set({ summary: `[Summary unavailable: ${article.title}]` })
            .where(eq(articles.id, article.id));
          failed++;
          this.logger.warn(
            `Empty summary for article ${article.id} — writing placeholder to prevent re-queue`,
          );
          continue;
        }

        // Include tags (if present) in the *embedding input* only. This gives
        // semantic retrieval (chat + feed) a soft tag signal without changing
        // the stored summary (which is shown in UI and used for context).
        // Tags are populated for (some) Dev.to articles; HN and pre-0006 articles have [].
        const articleTags: string[] = Array.isArray(article.tags)
          ? article.tags
          : [];
        const embedInput =
          articleTags.length > 0
            ? `${summary}\n\nTags: ${articleTags.join(', ')}`
            : summary;
        const embedding = await this.embed(embedInput);

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
