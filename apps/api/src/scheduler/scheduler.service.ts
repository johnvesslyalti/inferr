import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScraperService } from '../scraper/scraper.service';
import { AiService } from '../ai/ai.service';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly aiService: AiService,
    private readonly jobsService: JobsService,
  ) {}

  @Cron('0 2 * * *')
  async runDailyJobScrape() {
    this.logger.log('Starting daily job scrape (02:00 UTC)');
    try {
      const saved = await this.jobsService.scrapeRemotive();
      this.logger.log(`Jobs scraped: ${saved} new listings`);

      // Refresh the persisted market report off the fresh data so user requests
      // never trigger the OpenAI call synchronously.
      const report = await this.jobsService.generateMarketReport();
      this.logger.log(`Market report refreshed: ${report.roles.length} roles`);
    } catch (err) {
      this.logger.error(
        'Daily job scrape failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @Cron('30 1 * * *')
  async runDailyScrape() {
    this.logger.log('Starting daily scrape pipeline (01:30 UTC)');

    try {
      const scraped = await this.scraperService.scrapeAll();
      this.logger.log(`Scraped — HN: ${scraped.hn}, Dev.to: ${scraped.devto}`);

      const { processed, failed } =
        await this.aiService.processUnsummarized(50);
      this.logger.log(`Summarized/embedded: ${processed} ok, ${failed} failed`);

      const cleaned = await this.scraperService.cleanOldArticles(50);
      this.logger.log(`Pruned database to keep only ${cleaned} articles`);
    } catch (err) {
      this.logger.error(
        'Daily scrape pipeline failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
