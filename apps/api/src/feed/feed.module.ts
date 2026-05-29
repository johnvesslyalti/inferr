import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AiModule, AuthModule],
  providers: [FeedService],
  controllers: [FeedController],
})
export class FeedModule {}
