import { Controller, Post, UseGuards } from '@nestjs/common';
import { ScraperService, ScrapeResult } from './scraper.service';
import { ScraperKeyGuard } from './scraper-key.guard';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @UseGuards(ScraperKeyGuard)
  @Post('run')
  async run(): Promise<{ saved: ScrapeResult }> {
    const results = await this.scraperService.scrapeAll();
    return { saved: results };
  }
}
