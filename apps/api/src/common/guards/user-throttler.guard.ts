import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../db/schema';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const user = (req as Request & { user?: User }).user;
    return Promise.resolve(user?.id ?? req.ip ?? 'anonymous');
  }

  protected getRequestResponse(context: ExecutionContext): {
    req: Request;
    res: Record<string, unknown>;
  } {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Record<string, unknown>>();
    return { req, res };
  }
}
