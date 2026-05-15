import { Controller, Post, Get, Body } from '@nestjs/common';
import { RAGService } from './rag.service';

@Controller('rag')
export class RAGController {
  constructor(private ragService: RAGService) {}

  @Post('init')
  async initDemo() {
    await this.ragService.initializeDemoData();
    return {
      message: 'Demo data initialized',
      documents: this.ragService.getDocuments(),
    };
  }

  @Post('query')
  async query(@Body() body: { query: string }) {
    const { query } = body;

    if (!query) {
      return { error: 'Query is required' };
    }

    // Ensure demo data is loaded
    await this.ragService.initializeDemoData();

    try {
      const answer = await this.ragService.query(query);
      const retrievedDocs = await this.ragService.retrieveRelevantDocs(query);

      return {
        query,
        answer,
        retrievedDocs: retrievedDocs.map((doc) => ({
          id: doc.id,
          title: doc.metadata?.title,
          content: doc.content,
        })),
      };
    } catch (error) {
      return {
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('documents')
  getDocuments() {
    return {
      documents: this.ragService.getDocuments(),
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      message: 'RAG pipeline is running',
    };
  }
}
