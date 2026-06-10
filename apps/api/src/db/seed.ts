import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
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

  const existingUser = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'testuser@example.com'))
    .limit(1);

  let user: schema.User;
  if (existingUser.length > 0) {
    [user] = await db
      .update(schema.users)
      .set({ name: 'Test User', googleId: 'test-google-id-001' })
      .where(eq(schema.users.email, 'testuser@example.com'))
      .returning();
    console.log(`Updated user: ${user.email} (${user.id})`);
  } else {
    [user] = await db
      .insert(schema.users)
      .values({
        googleId: 'test-google-id-001',
        email: 'testuser@example.com',
        name: 'Test User',
      })
      .returning();
    console.log(`Inserted user: ${user.email} (${user.id})`);
  }

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
