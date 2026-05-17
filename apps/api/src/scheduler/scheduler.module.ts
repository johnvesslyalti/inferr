import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScraperModule } from '../scraper/scraper.module';
import { AiModule } from '../ai/ai.module';
import { ScrapePipelineProcessor, SCRAPE_QUEUE } from './scrape-pipeline.processor';
import { SchedulerController } from './scheduler.controller';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6380),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: SCRAPE_QUEUE }),
    ScraperModule,
    AiModule,
  ],
  providers: [ScrapePipelineProcessor],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
