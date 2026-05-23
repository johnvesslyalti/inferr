import './env';
import * as path from 'path';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { AppModule } from './app.module';
import { DRIZZLE } from './db/drizzle.provider';
import type { DrizzleDB } from './db/drizzle.provider';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

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

  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
  } catch {
    // Neon and managed Postgres providers pre-install pgvector; the user role
    // lacks superuser privileges to CREATE EXTENSION but the extension is
    // already active. Safe to ignore.
    logger.warn('Could not CREATE EXTENSION vector — assuming it is already enabled');
  }
  const migrationsFolder = path.join(__dirname, '../drizzle');
  await migrate(db, { migrationsFolder });
  logger.log('Migrations applied');

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  await app.listen(process.env.API_PORT ?? 3001);
}
void bootstrap();
