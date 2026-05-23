import { Controller, Post, UseGuards } from '@nestjs/common';
import { ScraperService, ScrapeResult } from './scraper.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @UseGuards(JwtAuthGuard)
  @Post('run')
  async run(): Promise<{ saved: ScrapeResult }> {
    const results = await this.scraperService.scrapeAll();
    return { saved: results };
  }
}
