import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';

@Module({
  providers: [ScraperService],
  controllers: [ScraperController],
  exports: [ScraperService],
})
export class ScraperModule {}
