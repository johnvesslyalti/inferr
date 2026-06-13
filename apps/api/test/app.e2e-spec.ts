import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { JobsController } from '../src/jobs/jobs.controller';
import { JobsService, MarketReport, JobReport } from '../src/jobs/jobs.service';
import { ScraperController } from '../src/scraper/scraper.controller';
import { ScraperService, ScrapeResult } from '../src/scraper/scraper.service';
import { AiService } from '../src/ai/ai.service';
import { FeedController } from '../src/feed/feed.controller';
import { FeedService, FeedResponse } from '../src/feed/feed.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import {
  mintAccessToken,
  setTestJwtEnv,
  restoreTestJwtEnv,
  TEST_JWT_SECRET,
  TEST_USER,
} from './test-utils';

/**
 * E2E tests using isolated TestModules + mocks.
 * This avoids importing the full AppModule (which pulls ChatModule + @langchain/langgraph + ESM-only uuid etc).
 * We test real HTTP routing + guards with supertest, using the shared test helper for valid JWTs on protected routes.
 */
describe('API E2E (isolated modules)', () => {
  let app: INestApplication<App>;

  beforeAll(() => {
    setTestJwtEnv();
  });

  afterAll(() => {
    restoreTestJwtEnv();
  });

  describe('Public: root + health (AppController)', () => {
    beforeEach(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [AppController],
        providers: [AppService],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('GET / returns Hello World!', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });

    it('GET /health returns status ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
    });
  });

  describe('Public + guarded jobs endpoints (JobsController + ScraperKeyGuard)', () => {
    let jobsService: jest.Mocked<JobsService>;
    let scraperService: jest.Mocked<ScraperService>;
    let aiService: jest.Mocked<AiService>;

    beforeEach(async () => {
      jobsService = {
        getMarketReport: jest.fn(),
        getReport: jest.fn(),
        scrapeRemotive: jest.fn(),
        generateMarketReport: jest.fn(),
      } as any;

      scraperService = {
        scrapeAll: jest.fn(),
        cleanOldArticles: jest.fn(),
      } as any;

      aiService = {
        processUnsummarized: jest.fn(),
      } as any;

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [], // no full modules
        controllers: [JobsController, ScraperController],
        providers: [
          { provide: JobsService, useValue: jobsService },
          { provide: ScraperService, useValue: scraperService },
          { provide: AiService, useValue: aiService },
          // ScraperKeyGuard is instantiated by Nest when @UseGuards present; it reads process.env directly
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('GET /jobs/market calls service and returns report', async () => {
      const fake: MarketReport = { roles: [{ role: 'AI/ML', demand: 5, trend: 'Explosive' }], generatedAt: new Date().toISOString() };
      jobsService.getMarketReport.mockResolvedValue(fake);

      const res = await request(app.getHttpServer()).get('/jobs/market').expect(200);
      expect(res.body).toEqual(fake);
      expect(jobsService.getMarketReport).toHaveBeenCalled();
    });

    it('GET /jobs/report calls service and returns aggregates', async () => {
      const fake: JobReport = { totalListings: 42, topSkills: [], roleBreakdown: [], topCompanies: [], generatedAt: new Date().toISOString() };
      jobsService.getReport.mockResolvedValue(fake);

      const res = await request(app.getHttpServer()).get('/jobs/report').expect(200);
      expect(res.body.totalListings).toBe(42);
    });

    it('POST /scraper/run requires SCRAPER_API_KEY and calls scraper + ai', async () => {
      const origKey = process.env.SCRAPER_API_KEY;
      process.env.SCRAPER_API_KEY = 'test-scraper-key-xyz';

      const scrapeRes: ScrapeResult = { hn: 10, devto: 5, content: { saved: 12, skipped: 3 } };
      scraperService.scrapeAll.mockResolvedValue(scrapeRes);
      scraperService.cleanOldArticles.mockResolvedValue(4);
      (aiService.processUnsummarized as jest.Mock).mockResolvedValue({ processed: 8, failed: 1 });

      await request(app.getHttpServer())
        .post('/scraper/run')
        .set('Authorization', 'Bearer test-scraper-key-xyz')
        .expect(201)
        .expect((r) => {
          expect(r.body.saved.hn).toBe(10);
          expect(r.body.summarized.processed).toBe(8);
          expect(r.body.cleaned).toBe(4);
        });

      // bad key
      await request(app.getHttpServer())
        .post('/scraper/run')
        .set('Authorization', 'Bearer wrong-key')
        .expect(401);

      process.env.SCRAPER_API_KEY = origKey;
    });
  });

  describe('Protected feed (JwtAuthGuard + FeedController)', () => {
    let feedService: jest.Mocked<FeedService>;

    beforeEach(async () => {
      feedService = {
        getPersonalizedFeed: jest.fn(),
        getDebugFeed: jest.fn(),
      } as any;

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          JwtModule.register({
            secret: TEST_JWT_SECRET,
            signOptions: { expiresIn: '15m' },
          }),
        ],
        controllers: [FeedController],
        providers: [
          { provide: FeedService, useValue: feedService },
          JwtAuthGuard,
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('GET /feed requires valid JWT (from test helper) and returns feed payload', async () => {
      const { authHeader } = await getTestAuthContextForE2E();
      const fakeFeed: FeedResponse = { hasMatches: true, articles: [{ title: 'A', summary: 's', url: 'u', source: 'hn' }], fallback: [] };
      feedService.getPersonalizedFeed.mockResolvedValue(fakeFeed);

      const res = await request(app.getHttpServer())
        .get('/feed')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.hasMatches).toBe(true);
      expect(feedService.getPersonalizedFeed).toHaveBeenCalledWith(TEST_USER.id);
    });

    it('GET /feed without token returns 401', async () => {
      await request(app.getHttpServer()).get('/feed').expect(401);
    });
  });
});

// Helper wrapper because top level await not used in describe; re-uses the exported mint fn + TEST_USER
async function getTestAuthContextForE2E() {
  const token = await mintAccessToken();
  return { user: TEST_USER, token, authHeader: `Bearer ${token}` };
}

