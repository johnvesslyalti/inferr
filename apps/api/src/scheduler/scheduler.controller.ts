import { Controller, HttpCode, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { SCRAPE_JOB, SCRAPE_QUEUE } from './scrape-pipeline.processor';

@Controller('scheduler')
export class SchedulerController {
  constructor(@InjectQueue(SCRAPE_QUEUE) private readonly queue: Queue) {}

  @Post('trigger')
  @HttpCode(202)
  async trigger() {
    const job = await this.queue.add(
      SCRAPE_JOB,
      {},
      { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
    );
    return { jobId: job.id, status: 'queued' };
  }
}
