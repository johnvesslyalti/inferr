import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { AiService } from '../ai/ai.service';
import { DRIZZLE } from '../db/drizzle.provider';
import { userInterests } from '../db/schema';

describe('FeedService (unit)', () => {
  let service: FeedService;
  let aiService: jest.Mocked<AiService>;
  let mockDb: any;

  const baseEmbedding = [
    0.1, 0.2 /* ... truncated in test, real uses 1536 but we don't care */,
  ];

  beforeEach(async () => {
    aiService = {
      embed: jest.fn(),
      summarize: jest.fn(),
      chat: jest.fn(),
      processUnsummarized: jest.fn(),
    } as any;

    // Mock db with support for select on userInterests + execute returning rows with cosine_distance
    mockDb = {
      select: jest.fn((_selection?: any) => {
        // Distinguish interests select vs others (but we only select interests in this service)
        return {
          from: jest.fn((table: any) => {
            if (table === userInterests) {
              return {
                where: jest.fn(() => ({
                  limit: jest.fn(() =>
                    Promise.resolve([{ tags: ['nextjs', 'llm'] }]),
                  ),
                })),
              };
            }
            return {
              where: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve([])),
              })),
            };
          }),
        };
      }),
      execute: jest.fn(),
      // not used directly but for completeness
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve({ rowCount: 1 })),
        })),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: AiService, useValue: aiService },
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds queryText from user interests and calls embed', async () => {
    aiService.embed.mockResolvedValue(baseEmbedding);
    mockDb.execute.mockResolvedValue({ rows: [] }); // no articles -> fallback empty

    const res = await service.getPersonalizedFeed('u-1');

    expect(aiService.embed).toHaveBeenCalledWith(
      'software engineering articles about nextjs, llm for developers',
    );
    expect(res.hasMatches).toBe(false);
    expect(res.articles).toEqual([]);
    expect(res.fallback).toEqual([]);
  });

  it('returns recent matched articles (distance < 0.5 after optional tag bonus) limited to 5', async () => {
    aiService.embed.mockResolvedValue(baseEmbedding);

    const now = new Date();
    const recent = new Date(now.getTime() - 1000 * 3600 * 12); // within 2 days

    mockDb.execute.mockResolvedValue({
      rows: [
        {
          id: 'a1',
          title: 'Next.js 15 Deep Dive',
          url: 'https://ex.com/1',
          source: 'hn',
          summary: 'Great new features.',
          created_at: recent.toISOString(),
          tags: ['nextjs'],
          cosine_distance: '0.31', // raw <0.5, and tag match subtracts 0.12 -> even better
        },
        {
          id: 'a2',
          title: 'LLM RAG Patterns',
          url: 'https://ex.com/2',
          source: 'devto',
          summary: 'Agentic stuff.',
          created_at: recent.toISOString(),
          tags: ['llm', 'rag'],
          cosine_distance: '0.42',
        },
        {
          id: 'a3',
          title: 'Old Irrelevant',
          url: 'https://ex.com/3',
          source: 'hn',
          summary: null,
          created_at: new Date(now.getTime() - 1000 * 3600 * 72).toISOString(), // 3 days ago -> not recent
          tags: [],
          cosine_distance: '0.10',
        },
        {
          id: 'a4',
          title: 'Barely Relevant Recent',
          url: 'https://ex.com/4',
          source: 'devto',
          summary: 'tangent',
          created_at: recent.toISOString(),
          tags: [],
          cosine_distance: '0.49',
        },
      ],
    });

    const res = await service.getPersonalizedFeed('u-1');

    expect(res.hasMatches).toBe(true);
    expect(res.articles.length).toBe(3); // a1,a2,a4 (a3 filtered by recency)
    expect(res.articles[0].title).toBe('Next.js 15 Deep Dive');
    expect(res.fallback).toEqual([]);
    // a1 had tag bonus applied in distance calc inside service
  });

  it('returns empty feed (no fallback archive) when no recent interest matches', async () => {
    aiService.embed.mockResolvedValue(baseEmbedding);

    const old = new Date(Date.now() - 1000 * 3600 * 72);

    mockDb.execute.mockResolvedValue({
      rows: [
        {
          id: 'f1',
          title: 'Good Match Old',
          url: 'f1',
          source: 'hn',
          summary: 's',
          created_at: old.toISOString(),
          tags: ['nextjs'],
          cosine_distance: '0.22',
        },
        {
          id: 'f2',
          title: 'Second Best',
          url: 'f2',
          source: 'devto',
          summary: null,
          created_at: old.toISOString(),
          tags: [],
          cosine_distance: '0.33',
        },
      ],
    });

    const res = await service.getPersonalizedFeed('u-1');

    expect(res.hasMatches).toBe(false);
    expect(res.articles).toEqual([]);
    expect(res.fallback).toEqual([]);
  });

  it('enforces source diversity by prioritizing unique sources in the top 5', async () => {
    aiService.embed.mockResolvedValue(baseEmbedding);

    const now = new Date();
    const recent = new Date(now.getTime() - 1000 * 3600 * 12); // within 24 hours

    mockDb.execute.mockResolvedValue({
      rows: [
        {
          id: 'a1',
          title: 'HN 1',
          url: 'https://ex.com/hn1',
          source: 'hn',
          summary: 's1',
          created_at: recent.toISOString(),
          tags: ['nextjs'],
          cosine_distance: '0.20', // score = 0.95 (since 0.20 - 0.15 tag boost = 0.05, score = 0.95)
        },
        {
          id: 'a2',
          title: 'HN 2',
          url: 'https://ex.com/hn2',
          source: 'hn',
          summary: 's2',
          created_at: recent.toISOString(),
          tags: ['nextjs'],
          cosine_distance: '0.22', // score = 0.93 (since 0.22 - 0.15 tag boost = 0.07, score = 0.93)
        },
        {
          id: 'a3',
          title: 'DevTo 1',
          url: 'https://ex.com/devto1',
          source: 'devto',
          summary: 's3',
          created_at: recent.toISOString(),
          tags: [],
          cosine_distance: '0.30', // score = 0.70 (no tag boost, score = 0.70)
        },
      ],
    });

    const res = await service.getPersonalizedFeed('u-1');

    expect(res.hasMatches).toBe(true);
    expect(res.articles.length).toBe(3);
    // The final articles should be sorted by score descending
    expect(res.articles[0].title).toBe('HN 1');
    expect(res.articles[0].score).toBeCloseTo(0.95, 2);
    expect(res.articles[1].title).toBe('HN 2');
    expect(res.articles[1].score).toBeCloseTo(0.93, 2);
    expect(res.articles[2].title).toBe('DevTo 1');
    expect(res.articles[2].score).toBeCloseTo(0.70, 2);
  });

  it('getDebugFeed returns raw cosine + similarityScore over top 20', async () => {
    aiService.embed.mockResolvedValue(baseEmbedding);
    mockDb.execute.mockResolvedValue({
      rows: [
        {
          id: 'd1',
          title: 'Debug 1',
          url: 'd1',
          source: 'hn',
          summary: 's',
          cosine_distance: '0.25',
        },
      ],
    });

    const debug = await service.getDebugFeed('u-1');

    expect(debug.queryText).toContain('nextjs');
    expect(debug.articles).toHaveLength(1);
    expect(debug.articles[0]).toEqual(
      expect.objectContaining({
        cosineDistance: 0.25,
        similarityScore: 0.75,
      }),
    );
  });

  it('handles user with no interests (falls back to generic query)', async () => {
    // override the interests select for this test
    mockDb.select.mockReturnValueOnce({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve([])), // no row
        })),
      })),
    });

    aiService.embed.mockResolvedValue(baseEmbedding);
    mockDb.execute.mockResolvedValue({ rows: [] });

    await service.getPersonalizedFeed('u-no-tags');

    expect(aiService.embed).toHaveBeenCalledWith(
      'software development programming tutorials',
    );
  });

  it('uses cached embedding if queryEmbedding is present and avoids calling aiService.embed', async () => {
    const cachedEmbedding = [0.9, 0.8];
    mockDb.select.mockReturnValueOnce({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() =>
            Promise.resolve([
              { tags: ['nextjs'], queryEmbedding: cachedEmbedding },
            ]),
          ),
        })),
      })),
    });

    mockDb.execute.mockResolvedValue({ rows: [] });

    await service.getPersonalizedFeed('u-cached');

    expect(aiService.embed).not.toHaveBeenCalled();
    expect(mockDb.execute).toHaveBeenCalled();
  });
});
