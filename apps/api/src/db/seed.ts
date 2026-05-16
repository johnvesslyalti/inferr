import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'ai_feed',
});

const db = drizzle(pool, { schema });

async function seed() {
  console.log('Seeding database...');

  const [user] = await db
    .insert(schema.users)
    .values({
      googleId: 'test-google-id-001',
      email: 'testuser@example.com',
      name: 'Test User',
    })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { name: 'Test User' },
    })
    .returning();

  console.log(`Upserted user: ${user.email} (${user.id})`);

  await db
    .insert(schema.userInterests)
    .values({
      userId: user.id,
      tags: ['nextjs', 'llm', 'python'],
    })
    .onConflictDoUpdate({
      target: schema.userInterests.userId,
      set: { tags: ['nextjs', 'llm', 'python'] },
    });

  console.log(`Upserted interests for ${user.email}: nextjs, llm, python`);
  console.log('Done.');
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
