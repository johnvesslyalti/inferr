import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { AiService } from '../ai/ai.service';
import { FeedService } from '../feed/feed.service';
import { AgenticRagService } from '../chat/agentic-rag.service';

@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private readonly mcpServer: McpServer;
  private readonly transports = new Map<string, StreamableHTTPServerTransport>();

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly aiService: AiService,
    private readonly feedService: FeedService,
    private readonly agenticRag: AgenticRagService,
  ) {
    this.mcpServer = this.buildServer();
  }

  private buildServer(): McpServer {
    const server = new McpServer({ name: 'inferr', version: '1.0.0' });

    server.tool(
      'search_articles',
      'Semantically search the Inferr article database scraped from Hacker News and Dev.to. Use when the user asks about a specific technology, framework, or programming topic.',
      { query: z.string().describe('Search query — a topic, question, or keywords') },
      async ({ query }) => {
        const embedding = await this.aiService.embed(query);
        const embeddingStr = `[${embedding.join(',')}]`;

        const rows = await this.db.execute<{
          title: string;
          url: string;
          source: string;
          summary: string | null;
        }>(sql`
          SELECT title, url, source, summary
          FROM articles
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${embeddingStr}::vector
          LIMIT 5
        `);

        if (rows.rows.length === 0) {
          return { content: [{ type: 'text', text: 'No articles found.' }] };
        }

        const text = rows.rows
          .map(
            (r, i) =>
              `${i + 1}. ${r.title}\n   Source: ${r.source}\n   URL: ${r.url}\n   Summary: ${r.summary ?? 'No summary available'}`,
          )
          .join('\n\n');

        return { content: [{ type: 'text', text }] };
      },
    );

    server.tool(
      'get_personalized_feed',
      "Fetch today's personalized article feed for an Inferr user based on their saved interests. Use when the user asks for recommendations or what to read today.",
      { userId: z.string().uuid().describe('The Inferr user UUID') },
      async ({ userId }) => {
        const feed = await this.feedService.getPersonalizedFeed(userId);
        const articles = feed.hasMatches ? feed.articles : feed.fallback;
        const label = feed.hasMatches
          ? 'Personalized matches for today'
          : 'Top picks (no recent matches for your interests)';

        const text =
          `${label}:\n\n` +
          articles
            .map(
              (a, i) =>
                `${i + 1}. ${a.title}\n   Source: ${a.source}\n   URL: ${a.url}\n   Summary: ${a.summary ?? 'No summary available'}`,
            )
            .join('\n\n');

        return { content: [{ type: 'text', text }] };
      },
    );

    server.tool(
      'ask_inferr',
      'Ask a technical question and get an answer grounded in the Inferr article knowledge base. Uses a full agentic RAG pipeline (retrieve → grade → rewrite → generate). Use when the user wants a detailed explanation or answer about a software development topic.',
      { question: z.string().describe('A technical question for software developers') },
      async ({ question }) => {
        const result = await this.agenticRag.query('mcp-anonymous', question, []);

        const sources =
          result.sources.length > 0
            ? '\n\nSources:\n' + result.sources.map((s) => `- ${s.title}: ${s.url}`).join('\n')
            : '';

        return { content: [{ type: 'text', text: result.answer + sources }] };
      },
    );

    return server;
  }

  isInitializeRequest(body: unknown): boolean {
    return isInitializeRequest(body);
  }

  createTransport(): StreamableHTTPServerTransport {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        this.logger.log(`MCP session opened: ${sessionId}`);
        this.transports.set(sessionId, transport);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        this.logger.log(`MCP session closed: ${sid}`);
        this.transports.delete(sid);
      }
    };

    return transport;
  }

  getTransport(sessionId: string): StreamableHTTPServerTransport | undefined {
    return this.transports.get(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.transports.has(sessionId);
  }

  getMcpServer(): McpServer {
    return this.mcpServer;
  }

  async onModuleDestroy() {
    for (const [sessionId, transport] of this.transports) {
      this.logger.log(`Closing MCP session on shutdown: ${sessionId}`);
      await transport.close();
    }
    this.transports.clear();
  }
}
