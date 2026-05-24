import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { users } from '../db/schema';

@Injectable()
export class GoogleTokenGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.id, token))
        .limit(1);

      const user = result[0];
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return undefined;
    }

    return parts[1];
  }
}
