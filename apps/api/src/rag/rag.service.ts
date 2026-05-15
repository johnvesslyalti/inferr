import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { VectorStoreService } from './vector-store.service';
import { DEMO_DOCUMENTS, Document } from './demo-data';

@Injectable()
export class RAGService {
  private client: Anthropic;
  private initialized = false;

  constructor(private vectorStore: VectorStoreService) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async initializeDemoData(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.vectorStore.clear();
    DEMO_DOCUMENTS.forEach((doc) => {
      this.vectorStore.addDocument(doc.id, doc.content, {
        title: doc.title,
      });
    });
    this.initialized = true;
  }

  async ingestDocuments(documents: Document[]): Promise<void> {
    documents.forEach((doc) => {
      this.vectorStore.addDocument(doc.id, doc.content, {
        title: doc.title,
      });
    });
  }

  async retrieveRelevantDocs(query: string, topK: number = 3) {
    return this.vectorStore.searchSimilar(query, topK);
  }

  async query(userQuery: string): Promise<string> {
    // Retrieve relevant documents
    const relevantDocs = this.vectorStore.searchSimilar(userQuery, 3);

    // Build context from retrieved documents
    const context = relevantDocs
      .map(
        (doc) =>
          `Title: ${doc.metadata?.title || 'Unknown'}\nContent: ${doc.content}`,
      )
      .join('\n\n');

    // Create prompt with context
    const systemPrompt = `You are a helpful AI assistant. Use the provided context to answer questions accurately.
If the context doesn't contain relevant information, say so honestly.

Context:
${context}`;

    // Call Claude API
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userQuery,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    return textContent ? textContent.text : 'No response generated';
  }

  getDocuments() {
    return this.vectorStore.getAllDocuments().map((doc) => ({
      id: doc.id,
      title: doc.metadata?.title,
      content: doc.content,
    }));
  }
}
