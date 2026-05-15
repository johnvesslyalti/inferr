import { Module } from '@nestjs/common';
import { RAGService } from './rag.service';
import { VectorStoreService } from './vector-store.service';
import { EmbeddingsService } from './embeddings.service';
import { RAGController } from './rag.controller';

@Module({
  providers: [RAGService, VectorStoreService, EmbeddingsService],
  controllers: [RAGController],
  exports: [RAGService],
})
export class RAGModule {}
