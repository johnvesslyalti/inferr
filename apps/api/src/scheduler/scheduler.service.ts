import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, lt } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { cronLocks } from '../db/schema';
import { ScraperService } from '../scraper/scraper.service';
import { AiService } from '../ai/ai.service';
import { JobsService } from '../jobs/jobs.service';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000; // 6 hours safety TTL

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly scraperService: ScraperService,
    private readonly aiService: AiService,
    private readonly jobsService: JobsService,
  ) {}

  @Cron('0 2 * * *')
  async runDailyJobScrape() {
    await this.runWithLock('runDailyJobScrape', SIX_HOURS_MS, async () => {
      this.logger.log('Starting daily job scrape (02:00 UTC)');
      try {
        const saved = await this.jobsService.scrapeRemotive();
        this.logger.log(`Jobs scraped: ${saved} new listings`);

        // Refresh the persisted market report off the fresh data so user requests
        // never trigger the OpenAI call synchronously.
        const report = await this.jobsService.generateMarketReport();
        this.logger.log(
          `Market report refreshed: ${report.roles.length} roles`,
        );
      } catch (err) {
        this.logger.error(
          'Daily job scrape failed',
          err instanceof Error ? err.stack : String(err),
        );
      }
    });
  }

  @Cron('30 1 * * *')
  async runDailyScrape() {
    await this.runWithLock('runDailyScrape', SIX_HOURS_MS, async () => {
      this.logger.log('Starting daily scrape pipeline (01:30 UTC)');

      try {
        const scraped = await this.scraperService.scrapeAll();
        this.logger.log(
          `Scraped — HN: ${scraped.hn}, Dev.to: ${scraped.devto}`,
        );

        const { processed, failed } =
          await this.aiService.processUnsummarized(50);
        this.logger.log(
          `Summarized/embedded: ${processed} ok, ${failed} failed`,
        );

        const cleaned = await this.scraperService.cleanOldArticles(100);
        this.logger.log(`Pruned database to keep only ${cleaned} articles`);
      } catch (err) {
        this.logger.error(
          'Daily scrape pipeline failed',
          err instanceof Error ? err.stack : String(err),
        );
      }
    });
  }

  /**
   * Runs the given callback under a distributed database-backed lock.
   * If the lock is already held by another instance and has not expired, the execution is skipped.
   *
   * @param jobName Unique name identifying the job
   * @param lockTtlMs How long the lock remains valid (e.g. 6 hours) before it is considered stale
   * @param callback The async function to execute if the lock is acquired
   */
  private async runWithLock(
    jobName: string,
    lockTtlMs: number,
    callback: () => Promise<void>,
  ): Promise<void> {
    const now = new Date();
    const expiredAt = new Date(now.getTime() - lockTtlMs);

    try {
      // 1. Clean up any expired locks for this specific job
      await this.db
        .delete(cronLocks)
        .where(
          and(
            eq(cronLocks.jobName, jobName),
            lt(cronLocks.lockedAt, expiredAt),
          ),
        );

      // 2. Try to insert a new lock row.
      // Since jobName is the primary key, this will fail with a unique constraint error
      // if another instance holds the active lock.
      await this.db.insert(cronLocks).values({
        jobName,
        lockedAt: now,
      });

      this.logger.log(`Acquired lock for job: ${jobName}`);
    } catch {
      // We assume a unique constraint violation (duplicate key) means the lock is held
      this.logger.warn(
        `Job ${jobName} is already locked by another active instance. Skipping execution.`,
      );
      return;
    }

    // 3. Execute the job and clean up the lock afterward
    try {
      await callback();
    } finally {
      try {
        await this.db.delete(cronLocks).where(eq(cronLocks.jobName, jobName));
        this.logger.log(`Released lock for job: ${jobName}`);
      } catch (cleanupErr) {
        this.logger.error(
          `Failed to release lock for job: ${jobName}`,
          cleanupErr instanceof Error ? cleanupErr.stack : String(cleanupErr),
        );
      }
    }
  }
}
