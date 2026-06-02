import { Inject, Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { articles, NewArticle } from '../db/schema';

export interface ScrapeResult {
  hn: number;
  devto: number;
  content: { saved: number; skipped: number };
}

interface SavedArticle {
  id: string;
  url: string;
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
  tag_list: string[];
}

const CONTENT_MAX_CHARS = 8000;
const FETCH_TIMEOUT_MS = 10_000;
const CONTENT_CONCURRENCY = 5;

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async scrapeAll(): Promise<ScrapeResult> {
    const [hn, devto] = await Promise.all([
      this.scrapeHackerNews(),
      this.scrapeDevTo(),
    ]);

    const newArticles = [...hn, ...devto];
    const content = await this.scrapeContentForArticles(newArticles);

    return { hn: hn.length, devto: devto.length, content };
  }

  async scrapeHackerNews(): Promise<SavedArticle[]> {
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
        tags: [], // HN API does not provide tags; only Dev.to articles get tags for now (see feed tag-bonus logic)
        publishedAt: new Date(hit.created_at),
      }));

    return this.saveArticles(rows);
  }

  async scrapeDevTo(): Promise<SavedArticle[]> {
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
      tags: article.tag_list ?? [],
      publishedAt: new Date(article.published_at),
    }));

    return this.saveArticles(rows);
  }

  private async saveArticles(rows: NewArticle[]): Promise<SavedArticle[]> {
    if (rows.length === 0) return [];

    const inserted = await this.db
      .insert(articles)
      .values(rows)
      .onConflictDoNothing({ target: articles.url })
      .returning({ id: articles.id, url: articles.url });

    // Update tags for articles that already existed — covers pre-migration rows
    // that defaulted to [] and Dev.to articles whose tags change between scrapes.
    // Only newly inserted rows are returned so content scraping stays scoped to new articles.
    const insertedUrls = new Set(inserted.map((r) => r.url));
    const existingWithTags = rows.filter(
      (r) => !insertedUrls.has(r.url) && (r.tags ?? []).length > 0,
    );
    if (existingWithTags.length > 0) {
      await Promise.all(
        existingWithTags.map((row) =>
          this.db
            .update(articles)
            .set({ tags: row.tags ?? [] })
            .where(eq(articles.url, row.url)),
        ),
      );
      this.logger.log(`Updated tags for ${existingWithTags.length} existing articles`);
    }

    this.logger.log(
      `Saved ${inserted.length} new articles (skipped ${rows.length - inserted.length} duplicates)`,
    );
    return inserted;
  }

  /**
   * Fetches the article's webpage and extracts readable text.
   * Returns null on any failure (timeout, non-200, parse error) so the
   * pipeline can skip silently — many sites block bots or paywall content.
   */
  async fetchContent(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ai-developer-feed/1.0' },
      });
      if (!res.ok) return null;

      const html = await res.text();
      const $ = cheerio.load(html);

      // Strip noise before extracting text
      $('script, style, nav, header, footer, aside').remove();

      let text = $('article').text().trim();
      if (!text) text = $('main').text().trim();
      if (!text) {
        text = $('p')
          .map((_, el) => $(el).text())
          .get()
          .join(' ')
          .trim();
      }

      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (!cleaned) return null;

      return cleaned.slice(0, CONTENT_MAX_CHARS);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetches and stores content for newly-inserted articles, in batches of
   * CONTENT_CONCURRENCY to avoid hammering sites or spiking memory.
   */
  private async scrapeContentForArticles(
    newArticles: SavedArticle[],
  ): Promise<{ saved: number; skipped: number }> {
    if (newArticles.length === 0) return { saved: 0, skipped: 0 };

    this.logger.log(`Fetching content for ${newArticles.length} articles...`);

    let saved = 0;
    let skipped = 0;

    for (let i = 0; i < newArticles.length; i += CONTENT_CONCURRENCY) {
      const batch = newArticles.slice(i, i + CONTENT_CONCURRENCY);

      const results = await Promise.all(
        batch.map(async (article) => ({
          id: article.id,
          content: await this.fetchContent(article.url),
        })),
      );

      const successful = results.filter((r) => r.content !== null);
      skipped += results.length - successful.length;

      if (successful.length > 0) {
        const scrapedAt = new Date();
        await Promise.all(
          successful.map((r) =>
            this.db
              .update(articles)
              .set({ content: r.content, contentScrapedAt: scrapedAt })
              .where(eq(articles.id, r.id)),
          ),
        );
        saved += successful.length;
      }
    }

    this.logger.log(`Content fetched — saved: ${saved}, skipped: ${skipped}`);
    return { saved, skipped };
  }
}
