import { Test, TestingModule } from '@nestjs/testing';
import { ScraperService } from './scraper.service';
import { DRIZZLE } from '../db/drizzle.provider';

describe('ScraperService (unit)', () => {
  let service: ScraperService;
  let mockDb: any;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([])),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve({ rowCount: 0 })),
        })),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScraperService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ScraperService>(ScraperService);

    // Preserve real fetch (we will spy per test)
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('scrapeHackerNews fetches HN, filters items with url, maps to NewArticle shape', async () => {
    const hnResponse = {
      hits: [
        { objectID: '1', title: 'TS 5.5', url: 'https://ex.com/ts', created_at: '2025-06-01T00:00:00Z' },
        { objectID: '2', title: 'No URL story', story_text: 'foo', created_at: '2025-06-01T00:00:00Z' }, // filtered
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => hnResponse,
    } as any);

    // Make the save return something (we test mapping here, save tested separately)
    mockDb.insert.mockReturnValueOnce({
      values: jest.fn(() => ({
        onConflictDoNothing: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([{ id: 'new1', url: 'https://ex.com/ts' }])),
        })),
      })),
    });

    const saved = await service.scrapeHackerNews();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=30',
    );
    expect(saved).toEqual([{ id: 'new1', url: 'https://ex.com/ts' }]);
    // tags: [] for HN
    const valuesArg = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(valuesArg[0]).toEqual(
      expect.objectContaining({ source: 'hn', tags: [], title: 'TS 5.5' }),
    );
  });

  it('scrapeDevTo fetches, maps tags, source=devto', async () => {
    const devtoResponse = [
      { id: 42, title: 'Vite Tips', url: 'https://dev.to/vite', published_at: '2025-06-09T10:00:00Z', tag_list: ['vite', 'frontend'] },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => devtoResponse,
    } as any);

    mockDb.insert.mockReturnValueOnce({
      values: jest.fn(() => ({
        onConflictDoNothing: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([{ id: 'd1', url: 'https://dev.to/vite' }])),
        })),
      })),
    });

    const saved = await service.scrapeDevTo();

    expect(saved).toHaveLength(1);
    const valuesArg = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(valuesArg[0]).toEqual(
      expect.objectContaining({ source: 'devto', tags: ['vite', 'frontend'] }),
    );
  });

  it('saveArticles (via scrape) skips duplicates via onConflictDoNothing and updates tags for pre-existing with new tags', async () => {
    // Simulate first scrape inserts 1, second scrape for same url returns 0 inserted but we update tags
    const rows = [
      { title: 'Dup', url: 'https://dup.com', source: 'devto', tags: ['newtag'], publishedAt: new Date() },
    ];

    // First call (imagine previous insert happened)
    mockDb.insert.mockReturnValueOnce({
      values: jest.fn(() => ({
        onConflictDoNothing: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([])), // 0 new
        })),
      })),
    });

    // The existingWithTags path will call update
    await (service as any).saveArticles(rows); // private but we can call via any for unit coverage of the tag update branch

    expect(mockDb.update).toHaveBeenCalled();
    // The set() was called on the builder returned by the update() call that happened inside saveArticles
    const updateCall = mockDb.update.mock.results[0]?.value;
    expect(updateCall?.set).toHaveBeenCalledWith({ tags: ['newtag'] });
  });

  it('fetchContent strips noise, falls back through article/main/p, truncates, returns null on failure', async () => {
    // Success path
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<html><script>bad</script><article><p>Hello <b>world</b></p><p>More text here for length.</p></article></html>',
    } as any);

    const content = await service.fetchContent('https://ex.com/good');
    expect(content).toContain('Hello world');
    expect(content?.length).toBeLessThanOrEqual(8000);

    // Failure path
    global.fetch = jest.fn().mockResolvedValue({ ok: false } as any);
    expect(await service.fetchContent('https://ex.com/404')).toBeNull();

    // Network error
    global.fetch = jest.fn().mockRejectedValue(new Error('boom'));
    expect(await service.fetchContent('https://ex.com/err')).toBeNull();
  });

  it('scrapeAll orchestrates HN + DevTo + content scrape for new articles', async () => {
    // Stub the two scrapers to avoid real net in this high level test
    jest.spyOn(service, 'scrapeHackerNews').mockResolvedValue([{ id: 'h1', url: 'https://h.com' }]);
    jest.spyOn(service, 'scrapeDevTo').mockResolvedValue([]);

    // content fetch for the new one
    jest.spyOn(service, 'fetchContent').mockResolvedValue('some article body');

    // The private scrapeContentForArticles will do update for content
    mockDb.update.mockReturnValue({
      set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve({ rowCount: 1 })) })),
    });

    const result = await service.scrapeAll();

    expect(result.hn).toBe(1);
    expect(result.devto).toBe(0);
    expect(result.content.saved).toBe(1);
    expect(service.fetchContent).toHaveBeenCalledWith('https://h.com');
  });
});
