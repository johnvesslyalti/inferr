import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

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

    if (!expected || key !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
