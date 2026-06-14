import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { userInterests } from '../db/schema';
import { AiService } from '../ai/ai.service';

export interface FeedArticle {
  title: string;
  summary: string | null;
  url: string;
  source: string;
  publishedAt: string | null;
}

export interface FeedResponse {
  hasMatches: boolean;
  articles: FeedArticle[];
  fallback: FeedArticle[];
}

export interface DebugFeedArticle {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  cosineDistance: number;
  similarityScore: number;
}

export interface DebugFeedResponse {
  queryText: string;
  articles: DebugFeedArticle[];
}

// Cosine distance below this = article is relevant to user interests
const RELEVANCE_THRESHOLD = 0.5;

// Articles newer than this are considered "today's feed"
const RECENCY_DAYS = 2;

// How much to reduce distance for articles whose tags overlap user interests
const TAG_BONUS = 0.12;

// Max number of articles to return in the personalized feed (top N after ranking + filters)
const FEED_LIMIT = 5;

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly aiService: AiService,
  ) {}

  async getPersonalizedFeed(userId: string): Promise<FeedResponse> {
    const interestRow = await this.db
      .select({
        tags: userInterests.tags,
        queryEmbedding: userInterests.queryEmbedding,
      })
      .from(userInterests)
      .where(eq(userInterests.userId, userId))
      .limit(1);

    const tags = interestRow[0]?.tags ?? [];
    const cachedEmbedding = interestRow[0]?.queryEmbedding;

    // Richer query text gives the embedding model more context than bare keywords
    const queryText =
      tags.length > 0
        ? `software engineering articles about ${tags.join(', ')} for developers`
        : 'software development programming tutorials';

    let embedding: number[];
    if (cachedEmbedding && cachedEmbedding.length > 0) {
      this.logger.log(`Using cached embedding for user ${userId}`);
      embedding = cachedEmbedding;
    } else {
      this.logger.log(
        `Generating embedding for user ${userId} | query: "${queryText}"`,
      );
      embedding = await this.aiService.embed(queryText);
      if (interestRow.length > 0) {
        await this.db
          .update(userInterests)
          .set({ queryEmbedding: embedding })
          .where(eq(userInterests.userId, userId));
      }
    }

    const embeddingStr = `[${embedding.join(',')}]`;

    const rows = await this.db.execute<{
      id: string;
      title: string;
      url: string;
      source: string;
      summary: string | null;
      created_at: string;
      published_at: string | null;
      tags: string[];
      cosine_distance: string;
    }>(
      sql`
        SELECT id, title, url, source, summary, created_at, published_at, tags,
          (embedding <=> ${embeddingStr}::vector) AS cosine_distance
        FROM articles
        WHERE embedding IS NOT NULL
        ORDER BY cosine_distance
        LIMIT 30
      `,
    );

    const recencyCutoff = new Date(
      Date.now() - RECENCY_DAYS * 24 * 60 * 60 * 1000,
    );
    const userTagsLower = tags.map((t) => t.toLowerCase());

    // Apply tag bonus in TypeScript — avoids SQL type conflicts
    const allArticles = rows.rows.map((r) => {
      const articleTags: string[] = Array.isArray(r.tags) ? r.tags : [];
      const hasTagMatch =
        userTagsLower.length > 0 &&
        articleTags.some((t) => userTagsLower.includes(t.toLowerCase()));
      const raw = Number(r.cosine_distance);
      const distance = Math.max(
        0,
        (isNaN(raw) ? 1 : raw) - (hasTagMatch ? TAG_BONUS : 0),
      );
      return {
        title: r.title,
        summary: r.summary,
        url: r.url,
        source: r.source,
        createdAt: r.created_at ? new Date(r.created_at) : new Date(0),
        publishedAt: r.published_at ? new Date(r.published_at) : null,
        distance,
      };
    });

    // Recent articles that pass the relevance threshold
    const matched = allArticles.filter(
      (a) => a.createdAt >= recencyCutoff && a.distance < RELEVANCE_THRESHOLD,
    );

    if (matched.length > 0) {
      this.logger.log(
        `${matched.length} articles matched interests within last ${RECENCY_DAYS} days`,
      );
      return {
        hasMatches: true,
        articles: matched.slice(0, FEED_LIMIT).map(toFeedArticle),
        fallback: [],
      };
    }

    // Nothing new — return best overall matches as fallback regardless of recency
    this.logger.log(
      `No recent matches — returning fallback for user ${userId}`,
    );
    return {
      hasMatches: false,
      articles: [],
      fallback: allArticles
        .sort((a, b) => a.distance - b.distance)
        .slice(0, FEED_LIMIT)
        .map(toFeedArticle),
    };
  }

  async getDebugFeed(userId: string): Promise<DebugFeedResponse> {
    const interestRow = await this.db
      .select({
        tags: userInterests.tags,
        queryEmbedding: userInterests.queryEmbedding,
      })
      .from(userInterests)
      .where(eq(userInterests.userId, userId))
      .limit(1);

    const tags = interestRow[0]?.tags ?? [];
    const cachedEmbedding = interestRow[0]?.queryEmbedding;
    const queryText =
      tags.length > 0
        ? `software engineering articles about ${tags.join(', ')} for developers`
        : 'software development programming tutorials';

    let embedding: number[];
    if (cachedEmbedding && cachedEmbedding.length > 0) {
      this.logger.log(`Using cached embedding for user ${userId} (debug)`);
      embedding = cachedEmbedding;
    } else {
      this.logger.log(
        `Generating embedding for user ${userId} (debug) | query: "${queryText}"`,
      );
      embedding = await this.aiService.embed(queryText);
      if (interestRow.length > 0) {
        await this.db
          .update(userInterests)
          .set({ queryEmbedding: embedding })
          .where(eq(userInterests.userId, userId));
      }
    }

    const embeddingStr = `[${embedding.join(',')}]`;

    const rows = await this.db.execute<{
      id: string;
      title: string;
      url: string;
      source: string;
      summary: string | null;
      cosine_distance: string;
    }>(
      sql`
        SELECT id, title, url, source, summary,
          (embedding <=> ${embeddingStr}::vector) AS cosine_distance
        FROM articles
        WHERE embedding IS NOT NULL
        ORDER BY cosine_distance
        LIMIT 20
      `,
    );

    return {
      queryText,
      articles: rows.rows.map((r) => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        url: r.url,
        source: r.source,
        cosineDistance: Number(r.cosine_distance),
        similarityScore: 1 - Number(r.cosine_distance),
      })),
    };
  }
}

function toFeedArticle(a: {
  title: string;
  summary: string | null;
  url: string;
  source: string;
  publishedAt?: Date | null;
  createdAt?: Date | null;
}): FeedArticle {
  const date = a.publishedAt || a.createdAt || null;
  return {
    title: a.title,
    summary: a.summary,
    url: a.url,
    source: a.source,
    publishedAt: date ? date.toISOString() : null,
  };
}
