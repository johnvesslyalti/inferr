import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { SCRAPE_QUEUE } from '../scheduler/scrape-pipeline.processor';

@Module({
  imports: [
    AiModule,
    AuthModule,
    BullModule.registerQueue({ name: SCRAPE_QUEUE }),
  ],
  providers: [FeedService],
  controllers: [FeedController],
})
export class FeedModule {}
