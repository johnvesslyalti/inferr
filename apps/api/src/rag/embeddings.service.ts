import { Injectable } from '@nestjs/common';

@Injectable()
export class EmbeddingsService {
  private vocabulary = new Map<string, number>();
  private embeddingDim = 100;

  constructor() {
    this.initializeVocabulary();
  }

  private initializeVocabulary() {
    const keywords = [
      'machine',
      'learning',
      'neural',
      'network',
      'deep',
      'artificial',
      'intelligence',
      'algorithm',
      'data',
      'pattern',
      'training',
      'language',
      'processing',
      'natural',
      'transformer',
      'attention',
      'classification',
      'recognition',
      'model',
      'layer',
    ];

    keywords.forEach((keyword, idx) => {
      this.vocabulary.set(keyword, idx);
    });
  }

  generateEmbedding(text: string): number[] {
    const embedding = new Array(this.embeddingDim).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    words.forEach((word) => {
      const idx = this.vocabulary.get(word);
      if (idx !== undefined && idx < this.embeddingDim) {
        embedding[idx] += 1;
      }
    });

    // Normalize the embedding
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, idx) => sum + val * vec2[idx], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
  }
}
