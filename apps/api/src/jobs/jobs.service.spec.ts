import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { AiService } from '../ai/ai.service';
import { DRIZZLE } from '../db/drizzle.provider';
import { jobs, marketReports } from '../db/schema';

describe('JobsService (unit)', () => {
  let service: JobsService;
  let aiService: jest.Mocked<AiService>;
  let mockDb: any;

  beforeEach(async () => {
    aiService = {
      embed: jest.fn(),
      summarize: jest.fn(),
      chat: jest.fn(),
      processUnsummarized: jest.fn(),
    } as any;

    mockDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve([])),
            })),
          })),
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve([])),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([])),
        })),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: AiService, useValue: aiService },
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMarketReport', () => {
    it('returns fresh cached report if within TTL without calling AI', async () => {
      const recentReport = {
        roles: [{ role: 'AI / ML', demand: 5, trend: 'Explosive Growth' }],
        generatedAt: new Date(Date.now() - 1000 * 60 * 60), // 1h ago
      };
      mockDb.select.mockReturnValueOnce({
        from: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([recentReport]),
          }),
        }),
      });

      const report = await service.getMarketReport();

      expect(report.roles).toHaveLength(1);
      expect(aiService.chat).not.toHaveBeenCalled();
    });

    it('generates via AI + persists when no or stale report (coalesces concurrent)', async () => {
      // No latest
      mockDb.select.mockReturnValueOnce({
        from: () => ({
          orderBy: () => ({ limit: () => Promise.resolve([]) }),
        }),
      });

      aiService.chat.mockResolvedValueOnce(
        '[{"role":"Backend","demand":4,"trend":"Very High"}]',
      );

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn(() => ({
          returning: jest.fn(() =>
            Promise.resolve([{
              roles: [{ role: 'Backend', demand: 4, trend: 'Very High' }],
              generatedAt: new Date(),
            }]),
          ),
        })),
      });

      // Also provide some jobs rows for the generateMarketReport query inside
      // We trigger a second select inside generate (the jobs one)
      // Override sequentially
      mockDb.select
        // second call inside generate (the 30d jobs)
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                { title: 'Senior Backend Eng', tags: ['node', 'postgres'] },
              ]),
            }),
          }),
        });

      const report = await service.getMarketReport();

      expect(aiService.chat).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledWith(marketReports);
      expect(report.roles[0].role).toBe('Backend');
    });
  });

  describe('getReport', () => {
    it('aggregates tags, categories, companies from last 30d jobs', async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      mockDb.select.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([
              { category: 'Engineering', tags: ['typescript', 'react'], company: 'Acme' },
              { category: 'Engineering', tags: ['typescript'], company: 'Acme' },
              { category: 'Data', tags: ['sql'], company: 'DataCo' },
            ]),
          }),
        }),
      });

      const r = await service.getReport();

      expect(r.totalListings).toBe(3);
      expect(r.topSkills.find((s) => s.skill === 'typescript')!.count).toBe(2);
      expect(r.roleBreakdown.find((c) => c.category === 'Engineering')!.count).toBe(2);
      expect(r.topCompanies[0]).toEqual({ company: 'Acme', count: 2 });
    });
  });

  describe('scrapeRemotive', () => {
    it('fetches, maps, inserts with onConflictDoNothing, returns count', async () => {
      const origFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jobs: [
            {
              id: 999,
              url: 'https://remotive.com/job/1',
              title: 'Remote FE',
              company_name: 'RemoteCo',
              category: 'Software Development',
              tags: ['react'],
              job_type: 'full_time',
              publication_date: '2025-06-10',
              candidate_required_location: 'Worldwide',
              salary: '$100k',
            },
          ],
        }),
      } as any);

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([{ id: 'j1' }])),
          })),
        })),
      });

      const count = await service.scrapeRemotive();
      expect(count).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://remotive.com/api/remote-jobs?category=software-dev',
        expect.objectContaining({ headers: { 'User-Agent': 'inferr/1.0' } }),
      );

      global.fetch = origFetch;
    });

    it('returns 0 and does not insert on empty jobs response', async () => {
      const origFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jobs: [] }),
      } as any);

      const count = await service.scrapeRemotive();
      expect(count).toBe(0);
      expect(mockDb.insert).not.toHaveBeenCalled();

      global.fetch = origFetch;
    });
  });
});
