import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScraperService } from '../scraper/scraper.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly aiService: AiService,
  ) {}

  @Cron('30 1 * * *')
  async runDailyScrape() {
    this.logger.log('Starting daily scrape pipeline (01:30 UTC)');

    try {
      const scraped = await this.scraperService.scrapeAll();
      this.logger.log(`Scraped — HN: ${scraped.hn}, Dev.to: ${scraped.devto}`);

      const { processed, failed } = await this.aiService.processUnsummarized(50);
      this.logger.log(`Summarized/embedded: ${processed} ok, ${failed} failed`);
    } catch (err) {
      this.logger.error('Daily scrape pipeline failed', err instanceof Error ? err.stack : String(err));
    }
  }
}
