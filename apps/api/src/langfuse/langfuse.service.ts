import { Injectable, Logger } from '@nestjs/common';
import { CallbackHandler } from 'langfuse-langchain';

@Injectable()
export class LangfuseService {
  private readonly logger = new Logger(LangfuseService.name);

  constructor() {
    if (this.isEnabled()) {
      this.logger.log('Langfuse integration is enabled.');
    } else {
      this.logger.warn(
        'Langfuse integration is disabled (missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY).',
      );
    }
  }

  /**
   * Checks if Langfuse integration is configured and enabled in environment.
   */
  isEnabled(): boolean {
    return !!(
      process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
    );
  }

  /**
   * Creates a CallbackHandler for LangChain / LangGraph if enabled.
   * Returns undefined if Langfuse is not configured.
   */
  createCallbackHandler(options?: {
    traceName?: string;
    userId?: string;
    sessionId?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }): CallbackHandler | undefined {
    if (!this.isEnabled()) {
      return undefined;
    }

    return new CallbackHandler({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
      ...options,
    });
  }
}
