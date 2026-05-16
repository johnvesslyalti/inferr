import { pgTable, uuid, varchar, timestamp, index, customType, text } from 'drizzle-orm/pg-core';

const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      return value.slice(1, -1).split(',').map(Number);
    },
  })(name);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    googleId: varchar('google_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    avatar: varchar('avatar', { length: 2048 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('users_google_id_idx').on(t.googleId),
    index('users_email_idx').on(t.email),
  ],
);

export const documentEmbeddings = pgTable(
  'document_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalId: varchar('external_id', { length: 255 }).notNull().unique(),
    content: varchar('content', { length: 10000 }).notNull(),
    title: varchar('title', { length: 500 }),
    embedding: vector('embedding', 1536).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('document_embeddings_external_id_idx').on(t.externalId)],
);

export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 500 }).notNull(),
    url: varchar('url', { length: 2048 }).notNull().unique(),
    source: varchar('source', { length: 255 }).notNull(),
    summary: text('summary'),
    embedding: vector('embedding', 1536),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('articles_source_idx').on(t.source),
    index('articles_published_at_idx').on(t.publishedAt),
  ],
);

export const userInterests = pgTable('user_interests', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  tags: text('tags').array().notNull().default([]),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
export type NewDocumentEmbedding = typeof documentEmbeddings.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type UserInterest = typeof userInterests.$inferSelect;
export type NewUserInterest = typeof userInterests.$inferInsert;
