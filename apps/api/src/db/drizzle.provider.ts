import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = NodePgDatabase<typeof schema>;

export const DrizzleProvider: Provider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: (config: ConfigService): DrizzleDB => {
    const ssl = config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false;
    const pool = new Pool({
      host: config.get<string>('DB_HOST', 'localhost'),
      port: config.get<number>('DB_PORT', 5432),
      user: config.get<string>('DB_USER', 'postgres'),
      password: config.get<string>('DB_PASS', 'postgres'),
      database: config.get<string>('DB_NAME', 'ai_feed'),
      ssl,
    });
    return drizzle(pool, { schema });
  },
};
