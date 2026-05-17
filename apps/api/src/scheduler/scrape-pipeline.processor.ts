import { OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { ScraperService } from '../scraper/scraper.service';
import { AiService } from '../ai/ai.service';

export const SCRAPE_QUEUE = 'scrape-pipeline';
export const SCRAPE_JOB = 'run';

@Processor(SCRAPE_QUEUE)
export class ScrapePipelineProcessor implements OnModuleInit {
  private readonly logger = new Logger(ScrapePipelineProcessor.name);

  constructor(
    @InjectQueue(SCRAPE_QUEUE) private readonly queue: Queue,
    private readonly scraperService: ScraperService,
    private readonly aiService: AiService,
  ) {}

  async onModuleInit() {
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === SCRAPE_JOB) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }

    await this.queue.add(
      SCRAPE_JOB,
      {},
      {
        repeat: { cron: '0 30 1 * * *' },
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 20,
        removeOnFail: 10,
      },
    );

    this.logger.log('Scrape pipeline scheduled: 01:30 UTC (07:00 IST) daily');
  }

  @Process(SCRAPE_JOB)
  async handle(job: Job) {
    this.logger.log(`Starting scrape pipeline (attempt ${job.attemptsMade + 1})`);

    const scraped = await this.scraperService.scrapeAll();
    this.logger.log(`Scraped — HN: ${scraped.hn}, Dev.to: ${scraped.devto}`);

    const { processed, failed } = await this.aiService.processUnsummarized(50);
    this.logger.log(`Summarized/embedded: ${processed} ok, ${failed} failed`);

    return { scraped, processed, failed };
  }
}
