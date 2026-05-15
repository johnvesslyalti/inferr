import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { documentEmbeddings, DocumentEmbedding } from '../db/schema';
import { EmbeddingsService } from './embeddings.service';

@Injectable()
export class VectorStoreService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private embeddingsService: EmbeddingsService,
  ) {}

  async addDocument(
    externalId: string,
    content: string,
    metadata?: { title?: string },
  ): Promise<void> {
    const embedding = await this.embeddingsService.generateEmbedding(content);

    await this.db
      .insert(documentEmbeddings)
      .values({
        externalId,
        content,
        title: metadata?.title,
        embedding,
      })
      .onConflictDoUpdate({
        target: documentEmbeddings.externalId,
        set: { content, title: metadata?.title, embedding },
      });
  }

  async searchSimilar(query: string, topK: number = 3): Promise<DocumentEmbedding[]> {
    const queryEmbedding = await this.embeddingsService.generateEmbedding(query);
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    const rows = await this.db.execute<DocumentEmbedding>(sql`
      SELECT id, external_id AS "externalId", content, title, embedding, created_at AS "createdAt"
      FROM document_embeddings
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `);

    return rows.rows;
  }

  async getAllDocuments(): Promise<DocumentEmbedding[]> {
    return this.db.select().from(documentEmbeddings);
  }

  async clear(): Promise<void> {
    await this.db.delete(documentEmbeddings);
  }
}
