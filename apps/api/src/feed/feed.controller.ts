import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import dns from 'node:dns/promises';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeedService } from './feed.service';
import type { User } from '../db/schema';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getFeed(@Req() req: Request) {
    const user = req.user as User;
    return this.feedService.getPersonalizedFeed(user.id);
  }

  @Get('debug')
  @UseGuards(JwtAuthGuard)
  async getDebugFeed(@Req() req: Request) {
    const user = req.user as User;
    return this.feedService.getDebugFeed(user.id);
  }

  @Get('diagnose-network')
  async diagnoseNetwork() {
    const results: Record<string, unknown> = {};

    try {
      results.dns = await dns.lookup('api.openai.com', { all: true });
    } catch (e) {
      results.dns = { error: e instanceof Error ? e.message : String(e) };
    }

    try {
      const start = Date.now();
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });
      results.fetch = {
        status: res.status,
        statusText: res.statusText,
        duration: Date.now() - start,
        body: (await res.text()).substring(0, 1000),
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      results.fetch = { error: err.message, stack: err.stack };
    }

    return results;
  }
}
