import './env';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const dataSource = app.get(DataSource);
  if (dataSource.isInitialized) {
    logger.log('Database connection is healthy');
  } else {
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
