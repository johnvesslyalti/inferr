import { Injectable } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

@Injectable()
export class VectorStoreService {
  private vectors: Map<string, VectorDocument> = new Map();

  constructor(private embeddingsService: EmbeddingsService) {}

  addDocument(
    id: string,
    content: string,
    metadata?: Record<string, any>,
  ): void {
    const embedding = this.embeddingsService.generateEmbedding(content);
    this.vectors.set(id, {
      id,
      content,
      embedding,
      metadata,
    });
  }

  searchSimilar(query: string, topK: number = 3): VectorDocument[] {
    const queryEmbedding =
      this.embeddingsService.generateEmbedding(query);

    const scores = Array.from(this.vectors.values()).map((doc) => ({
      doc,
      score: this.embeddingsService.cosineSimilarity(
        queryEmbedding,
        doc.embedding,
      ),
    }));

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => item.doc);
  }

  getDocument(id: string): VectorDocument | undefined {
    return this.vectors.get(id);
  }

  getAllDocuments(): VectorDocument[] {
    return Array.from(this.vectors.values());
  }

  clear(): void {
    this.vectors.clear();
  }
}
