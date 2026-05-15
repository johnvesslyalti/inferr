import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { VectorStoreService } from './vector-store.service';
import { DEMO_DOCUMENTS, Document } from './demo-data';

@Injectable()
export class RAGService {
  private client: OpenAI;

  constructor(private vectorStore: VectorStoreService) {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async initializeDemoData(): Promise<void> {
    await this.vectorStore.clear();
    for (const doc of DEMO_DOCUMENTS) {
      await this.vectorStore.addDocument(doc.id, doc.content, { title: doc.title });
    }
  }

  async ingestDocuments(documents: Document[]): Promise<void> {
    for (const doc of documents) {
      await this.vectorStore.addDocument(doc.id, doc.content, { title: doc.title });
    }
  }

  async retrieveRelevantDocs(query: string, topK: number = 3) {
    return this.vectorStore.searchSimilar(query, topK);
  }

  async query(userQuery: string): Promise<string> {
    const relevantDocs = await this.vectorStore.searchSimilar(userQuery, 3);

    const context = relevantDocs
      .map((doc) => `Title: ${doc.title ?? 'Unknown'}\nContent: ${doc.content}`)
      .join('\n\n');

    const systemPrompt = `You are a helpful AI assistant. Use the provided context to answer questions accurately.
If the context doesn't contain relevant information, say so honestly.

Context:
${context}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
      ],
    });

    return response.choices[0]?.message?.content || 'No response generated';
  }

  async getDocuments() {
    const docs = await this.vectorStore.getAllDocuments();
    return docs.map((doc) => ({
      id: doc.externalId,
      title: doc.title,
      content: doc.content,
    }));
  }
}
