import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, url } = req;
    const start = Date.now();

    res.on('finish', () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      const level =
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
      this.logger[level](`${method} ${url} ${statusCode} +${ms}ms`);
    });

    next();
  }
}
