import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { userInterests } from '../db/schema';
import { AiService } from '../ai/ai.service';
import {
  SCRAPE_QUEUE,
  SCRAPE_JOB,
} from '../scheduler/scrape-pipeline.processor';

export interface FeedArticle {
  title: string;
  summary: string | null;
  url: string;
  source: string;
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly aiService: AiService,
    @InjectQueue(SCRAPE_QUEUE) private readonly scrapeQueue: Queue,
  ) {}

  async getPersonalizedFeed(userId: string): Promise<FeedArticle[]> {
    const interestRow = await this.db
      .select({ tags: userInterests.tags })
      .from(userInterests)
      .where(eq(userInterests.userId, userId))
      .limit(1);

    const tags = interestRow[0]?.tags ?? [];
    const queryText =
      tags.length > 0 ? tags.join(' ') : 'software development programming';

    this.logger.log(`Building feed for user ${userId} with tags: ${queryText}`);

    const embedding = await this.aiService.embed(queryText);
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
        LIMIT 5
      `,
    );

    const articles = rows.rows.map((r) => ({
      title: r.title,
      summary: r.summary,
      url: r.url,
      source: r.source,
    }));

    if (articles.length === 0) {
      const jobs = await this.scrapeQueue.getJobs(['active', 'waiting']);
      const alreadyRunning = jobs.some(
        (j) => j.name === SCRAPE_JOB && !j.opts.repeat,
      );
      if (!alreadyRunning) {
        this.logger.log('No articles found — triggering scraper automatically');
        await this.scrapeQueue.add(
          SCRAPE_JOB,
          {},
          { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
        );
      }
    }

    return articles;
  }
}
