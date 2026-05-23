import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { articles, NewArticle } from '../db/schema';

export interface ScrapeResult {
  hn: number;
  devto: number;
}

interface HNHit {
  objectID: string;
  title: string;
  url?: string;
  story_text?: string;
  created_at: string;
}

interface DevToArticle {
  id: number;
  title: string;
  url: string;
  published_at: string;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async scrapeAll(): Promise<ScrapeResult> {
    const [hn, devto] = await Promise.all([
      this.scrapeHackerNews(),
      this.scrapeDevTo(),
    ]);
    return { hn, devto };
  }

  async scrapeHackerNews(): Promise<number> {
    this.logger.log('Scraping Hacker News...');

    const res = await fetch(
      'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=30',
    );
    if (!res.ok) throw new Error(`HN API error: ${res.status}`);

    const data = (await res.json()) as { hits: HNHit[] };

    const rows: NewArticle[] = data.hits
      .filter((hit) => hit.url)
      .map((hit) => ({
        title: hit.title,
        url: hit.url!,
        source: 'hn',
        publishedAt: new Date(hit.created_at),
      }));

    return this.saveArticles(rows);
  }

  async scrapeDevTo(): Promise<number> {
    this.logger.log('Scraping Dev.to...');

    const res = await fetch('https://dev.to/api/articles?top=1&per_page=30', {
      headers: { 'User-Agent': 'ai-developer-feed/1.0' },
    });
    if (!res.ok) throw new Error(`Dev.to API error: ${res.status}`);

    const data = (await res.json()) as DevToArticle[];

    const rows: NewArticle[] = data.map((article) => ({
      title: article.title,
      url: article.url,
      source: 'devto',
      publishedAt: new Date(article.published_at),
    }));

    return this.saveArticles(rows);
  }

  private async saveArticles(rows: NewArticle[]): Promise<number> {
    if (rows.length === 0) return 0;

    const inserted = await this.db
      .insert(articles)
      .values(rows)
      .onConflictDoNothing({ target: articles.url })
      .returning({ id: articles.id });

    this.logger.log(
      `Saved ${inserted.length} new articles (skipped ${rows.length - inserted.length} duplicates)`,
    );
    return inserted.length;
  }
}
