import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';

import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { AiService } from '../ai/ai.service';
import type { ChatSource, ChatResult, GraphHistoryMessage } from './dto/chat.dto';

interface RetrievedDoc {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string | null;
}

interface RagState {
  question: string;
  history: GraphHistoryMessage[];
  documents: RetrievedDoc[];
  relevantDocuments: RetrievedDoc[];
  answer?: string;
  sources: ChatSource[];
  iterations: number;
}

const MAX_ITERATIONS = 2;
const RETRIEVAL_K = 6;

const RelevanceSchema = z.object({
  relevant_doc_indices: z
    .array(z.number())
    .describe('Zero-based indices of the documents from the provided list that are relevant to answering the question. Return an empty array if none are relevant.'),
});

@Injectable()
export class AgenticRagService {
  private readonly logger = new Logger(AgenticRagService.name);
  private readonly llm: ChatOpenAI;
  private readonly graph: any;

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly aiService: AiService,
  ) {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 500,
    });

    this.graph = this.buildGraph();
  }

  private buildGraph() {
    const State = Annotation.Root({
      question: Annotation<string>(),
      history: Annotation<GraphHistoryMessage[]>({
        reducer: (curr, update) => update ?? curr ?? [],
        default: () => [],
      }),
      documents: Annotation<RetrievedDoc[]>({
        reducer: (curr, update) => update ?? curr ?? [],
        default: () => [],
      }),
      relevantDocuments: Annotation<RetrievedDoc[]>({
        reducer: (curr, update) => update ?? curr ?? [],
        default: () => [],
      }),
      answer: Annotation<string>(),
      sources: Annotation<ChatSource[]>({
        reducer: (curr, update) => update ?? curr ?? [],
        default: () => [],
      }),
      iterations: Annotation<number>({
        reducer: (curr, update) => update ?? curr ?? 0,
        default: () => 0,
      }),
    });

    const workflow = new StateGraph(State)
      .addNode('retrieve', this.retrieveNode.bind(this))
      .addNode('gradeDocuments', this.gradeDocumentsNode.bind(this))
      .addNode('rewriteQuery', this.rewriteQueryNode.bind(this))
      .addNode('generate', this.generateNode.bind(this))
      .addEdge(START, 'retrieve')
      .addEdge('retrieve', 'gradeDocuments')
      .addConditionalEdges('gradeDocuments', this.routeAfterGrading.bind(this), {
        generate: 'generate',
        rewrite: 'rewriteQuery',
      })
      .addEdge('rewriteQuery', 'retrieve')
      .addEdge('generate', END);

    return workflow.compile();
  }

  /**
   * Public entry point. Accepts optional conversation history for better multi-turn RAG.
   */
  async query(
    userId: string,
    question: string,
    history: GraphHistoryMessage[] = [],
  ): Promise<ChatResult> {
    this.logger.log(`Agentic RAG query from user ${userId}: "${question}" (history: ${history.length} turns)`);

    const initialState: Partial<RagState> = {
      question: question.trim(),
      history,
      iterations: 0,
    };

    const finalState = await this.graph.invoke(initialState as any);

    return {
      answer: finalState.answer?.trim() ?? '',
      sources: finalState.sources ?? [],
    };
  }

  // --- Nodes ---

  private async retrieveNode(state: RagState): Promise<Partial<RagState>> {
    const embedding = await this.aiService.embed(state.question);
    const embeddingStr = `[${embedding.join(',')}]`;

    const rows = await this.db.execute<{
      id: string;
      title: string;
      url: string;
      source: string;
      summary: string | null;
    }>(
      sql`
        SELECT id, title, url, source, summary
        FROM articles
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${RETRIEVAL_K}
      `,
    );

    const documents: RetrievedDoc[] = rows.rows.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      source: r.source,
      summary: r.summary,
    }));

    this.logger.log(`Retrieved ${documents.length} candidate documents for question (iter ${state.iterations})`);

    return { documents };
  }

  private async gradeDocumentsNode(state: RagState): Promise<Partial<RagState>> {
    if (state.documents.length === 0) {
      return { relevantDocuments: [] };
    }

    const docsForPrompt = state.documents
      .map(
        (doc, i) =>
          `[${i}] Title: ${doc.title}\nSource: ${doc.source}\nSummary: ${doc.summary ?? 'No summary.'}`,
      )
      .join('\n\n');

    const system = `You are an expert relevance grader for a software developer knowledge base.
Given a user question and a list of article summaries, return the 0-based indices of ONLY the documents that contain information directly useful for answering the question.
Be strict: if a document is only tangentially related or lacks concrete details, do not include it.
Return an empty array if none of the documents are relevant enough.`;

    const user = `Question: ${state.question}\n\nDocuments:\n${docsForPrompt}\n\nReturn JSON only.`;

    const structuredLlm = this.llm.withStructuredOutput(RelevanceSchema);

    try {
      const result = await structuredLlm.invoke([
        { role: 'system', content: system },
        { role: 'user', content: user },
      ]);

      const indices = new Set(result.relevant_doc_indices.filter((i) => i >= 0 && i < state.documents.length));
      const relevantDocuments = state.documents.filter((_, idx) => indices.has(idx));

      this.logger.log(`Graded: ${relevantDocuments.length}/${state.documents.length} docs marked relevant`);

      return { relevantDocuments };
    } catch (err) {
      this.logger.warn(`Grading failed, falling back to using all retrieved docs: ${err}`);
      return { relevantDocuments: state.documents };
    }
  }

  private routeAfterGrading(state: RagState): 'generate' | 'rewrite' {
    const hasRelevant = (state.relevantDocuments?.length ?? 0) > 0;
    const canRetry = (state.iterations ?? 0) < MAX_ITERATIONS;

    if (hasRelevant) {
      return 'generate';
    }
    if (canRetry) {
      this.logger.log(`No relevant docs — will rewrite query (iter ${state.iterations})`);
      return 'rewrite';
    }
    // Give up and generate with whatever we have (even if empty)
    return 'generate';
  }

  private async rewriteQueryNode(state: RagState): Promise<Partial<RagState>> {
    const historyText = state.history
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const system = `You are a query rewriter for semantic search over a database of software engineering articles (Hacker News + Dev.to).
Given the conversation history and the latest user question, produce a single, precise, standalone search query (max 25 words) that will surface the most relevant articles.
Focus on technical keywords, frameworks, concepts. Do not include conversational filler. Output ONLY the rewritten query.`;

    const user = `Conversation so far:\n${historyText || '(no prior turns)'}\n\nLatest question: ${state.question}\n\nRewritten search query:`;

    try {
      const response = await this.llm.invoke([
        { role: 'system', content: system },
        { role: 'user', content: user },
      ]);

      const newQuestion = (response.content as string)?.trim().replace(/^["']|["']$/g, '') || state.question;

      this.logger.log(`Rewrote query: "${state.question}" -> "${newQuestion}"`);

      return {
        question: newQuestion,
        iterations: (state.iterations ?? 0) + 1,
        // Clear previous retrievals so next retrieve populates fresh
        documents: [],
        relevantDocuments: [],
      };
    } catch (err) {
      this.logger.warn(`Rewrite failed, reusing original question: ${err}`);
      return {
        iterations: (state.iterations ?? 0) + 1,
        documents: [],
        relevantDocuments: [],
      };
    }
  }

  private async generateNode(state: RagState): Promise<Partial<RagState>> {
    const contextArticles = state.relevantDocuments.length > 0 ? state.relevantDocuments : state.documents;

    const context = contextArticles
      .map(
        (a, i) =>
          `[${i + 1}] ${a.title}\nSummary: ${a.summary ?? 'No summary available.'}\nURL: ${a.url}`,
      )
      .join('\n\n');

    const historyMessages = state.history.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const systemContent =
      'You are a helpful assistant for software developers. Answer the question using only the provided article context from the knowledge base. ' +
      'Be concise, technical, and cite specific details where possible. ' +
      'If the context does not contain enough information, say so clearly. Do not make up facts.';

    const userContent = context
      ? `Context articles:\n\n${context}\n\nQuestion: ${state.question}`
      : `No relevant articles were found in the knowledge base.\n\nQuestion: ${state.question}`;

    const messages: any[] = [
      { role: 'system', content: systemContent },
      ...historyMessages,
      { role: 'user', content: userContent },
    ];

    try {
      const response = await this.llm.invoke(messages);
      const answer = (response.content as string)?.trim() ?? '';

      const sources: ChatSource[] = contextArticles.map((a) => ({
        title: a.title,
        url: a.url,
        source: a.source,
      }));

      this.logger.log(`Generated answer using ${sources.length} sources`);

      return { answer, sources };
    } catch (err) {
      this.logger.error(`Generation failed: ${err}`);
      return {
        answer: 'Sorry, I ran into an error while generating the response.',
        sources: contextArticles.map((a) => ({
          title: a.title,
          url: a.url,
          source: a.source,
        })),
      };
    }
  }
}
