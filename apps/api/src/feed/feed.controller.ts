import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { GoogleTokenGuard } from '../auth/google-token.guard';
import { FeedService } from './feed.service';
import type { User } from '../db/schema';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @UseGuards(GoogleTokenGuard)
  async getFeed(@Req() req: Request) {
    const user = req.user as User;
    return this.feedService.getPersonalizedFeed(user.id);
  }
}
