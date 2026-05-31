import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ScraperKeyGuard } from '../scraper/scraper-key.guard';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('report')
  async getReport() {
    return this.jobsService.getReport();
  }

  @Post('scrape')
  @UseGuards(ScraperKeyGuard)
  async scrape() {
    const saved = await this.jobsService.scrapeRemotive();
    return { saved };
  }
}
