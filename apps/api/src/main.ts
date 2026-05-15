import './env';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AppModule } from './app.module';
import { DRIZZLE } from './db/drizzle.provider';
import type { DrizzleDB } from './db/drizzle.provider';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const db = app.get<DrizzleDB>(DRIZZLE);
  try {
    await db.execute(sql`SELECT 1`);
    logger.log('Database connection is healthy');
  } catch {
    logger.error('Database connection failed');
    process.exit(1);
  }

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(process.env.API_PORT ?? 3001);
}
bootstrap();
