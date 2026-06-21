import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
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
    const results: any = {};
    const dns = require('dns/promises');
    
    try {
      results.dns = await dns.lookup('api.openai.com', { all: true });
    } catch (e: any) {
      results.dns = { error: e.message };
    }
    
    try {
      const start = Date.now();
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        }
      });
      results.fetch = {
        status: res.status,
        statusText: res.statusText,
        duration: Date.now() - start,
        body: (await res.text()).substring(0, 1000),
      };
    } catch (e: any) {
      results.fetch = { error: e.message, stack: e.stack };
    }
    
    return results;
  }
}
