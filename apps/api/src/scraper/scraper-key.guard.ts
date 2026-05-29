import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class ScraperKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const key = authHeader.slice(7);
    const expected = process.env.SCRAPER_API_KEY;

    if (!expected) {
      throw new UnauthorizedException('Invalid API key');
    }

    const keyBuf = Buffer.from(key);
    const expectedBuf = Buffer.from(expected);

    if (
      keyBuf.length !== expectedBuf.length ||
      !timingSafeEqual(keyBuf, expectedBuf)
    ) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
