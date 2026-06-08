import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Response } from 'express';

import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from '@modelcontextprotocol/sdk/shared/auth.js';

import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { mcpTokens } from '../db/schema';

// MCP access token lifetime — longer than the web app's 15m JWT since this is a
// machine session (Claude Desktop), not a browser tab.
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PENDING_TTL_MS = 5 * 60 * 1000; // auth requests + codes expire in 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface PendingAuthorization {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  clientState?: string;
  expiresAt: number;
}

interface PendingAuthCode {
  userId: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  expiresAt: number;
}

/**
 * Implements the MCP OAuth 2.1 authorization server for Inferr.
 *
 * Authentication itself is delegated to Google (reusing the existing web-app
 * Google OAuth). This provider only manages MCP-specific concerns: client
 * registration, PKCE authorization codes, and MCP access/refresh tokens.
 *
 * MCP tokens are deliberately separate from the web app's tokens:
 * - access token: JWT signed with JWT_SECRET, carries `type: 'mcp_access'`
 * - refresh token: opaque random string, SHA256-hashed in the `mcp_tokens` table
 * The `type` claim prevents a web JWT being accepted here and vice versa.
 */
@Injectable()
export class McpOAuthProvider
  implements OAuthServerProvider, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(McpOAuthProvider.name);

  // Registered MCP clients (Claude Desktop registers itself on each startup).
  // TODO: persist to DB so clients survive API restarts without re-registering.
  private readonly clients = new Map<string, OAuthClientInformationFull>();

  // mcpState -> the authorization request we parked before redirecting to Google.
  // TODO: move to Redis/DB before running multiple API instances — an auth flow
  // started on instance A will fail if the Google callback lands on instance B.
  private readonly pendingMcpAuthorizations = new Map<string, PendingAuthorization>();

  // authCode -> the data needed to fulfil the PKCE token exchange.
  // Same single-instance caveat as pendingMcpAuthorizations above.
  private readonly pendingAuthCodes = new Map<string, PendingAuthCode>();

  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
  ) {}

  onModuleInit() {
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS);
    // Don't keep the event loop alive solely for this timer.
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [key, val] of this.pendingMcpAuthorizations) {
      if (val.expiresAt < now) this.pendingMcpAuthorizations.delete(key);
    }
    for (const [key, val] of this.pendingAuthCodes) {
      if (val.expiresAt < now) this.pendingAuthCodes.delete(key);
    }
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  // --- OAuthRegisteredClientsStore ---

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId: string) => this.clients.get(clientId),
      registerClient: (
        client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
      ) => {
        // The SDK's registration handler already generated client_id/secret and
        // attached them to this object before calling us — just persist + echo.
        const full = client as OAuthClientInformationFull;
        this.clients.set(full.client_id, full);
        this.logger.log(`Registered MCP client ${full.client_id}`);
        return full;
      },
    };
  }

  // --- Authorization flow ---

  authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const mcpState = randomUUID();
    this.pendingMcpAuthorizations.set(mcpState, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: params.scopes ?? ['mcp'],
      clientState: params.state,
      expiresAt: Date.now() + PENDING_TTL_MS,
    });

    // Carry our internal state through Google's opaque `state` param. We only
    // need mcpState; the client's own state is restored from our stored record.
    const googleState = Buffer.from(mcpState, 'utf8').toString('base64url');
    res.redirect(`/auth/google/mcp?state=${encodeURIComponent(googleState)}`);
    return Promise.resolve();
  }

  /**
   * Called by AuthController after Google sign-in completes. Converts a parked
   * authorization request into a single-use auth code bound to the user.
   */
  completeMcpAuthorization(
    userId: string,
    googleState: string,
  ): { redirectUri: string; authCode: string; clientState?: string } {
    const mcpState = Buffer.from(googleState, 'base64url').toString('utf8');
    const pending = this.pendingMcpAuthorizations.get(mcpState);
    if (!pending) {
      throw new Error('Unknown or expired MCP authorization state');
    }
    this.pendingMcpAuthorizations.delete(mcpState);

    const authCode = randomUUID();
    this.pendingAuthCodes.set(authCode, {
      userId,
      clientId: pending.clientId,
      codeChallenge: pending.codeChallenge,
      redirectUri: pending.redirectUri,
      expiresAt: Date.now() + PENDING_TTL_MS,
    });

    return {
      redirectUri: pending.redirectUri,
      authCode,
      clientState: pending.clientState,
    };
  }

  challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const pending = this.pendingAuthCodes.get(authorizationCode);
    if (!pending || pending.expiresAt < Date.now()) {
      return Promise.reject(new Error('Invalid or expired authorization code'));
    }
    // The SDK verifies the PKCE code_verifier against this challenge for us.
    return Promise.resolve(pending.codeChallenge);
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<OAuthTokens> {
    const pending = this.pendingAuthCodes.get(authorizationCode);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new Error('Invalid or expired authorization code');
    }
    if (pending.clientId !== client.client_id) {
      throw new Error('Authorization code was issued to a different client');
    }
    // Single-use.
    this.pendingAuthCodes.delete(authorizationCode);

    return this.issueTokens(pending.userId, client.client_id);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
  ): Promise<OAuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const rows = await this.db
      .select()
      .from(mcpTokens)
      .where(eq(mcpTokens.tokenHash, tokenHash))
      .limit(1);

    const stored = rows[0];
    if (!stored) {
      throw new Error('Invalid refresh token');
    }
    if (stored.revoked) {
      // Reuse of an already-rotated token => possible theft. Nuke the whole
      // chain for this user so the attacker and victim both must re-auth.
      await this.db
        .update(mcpTokens)
        .set({ revoked: true, revokedAt: new Date() })
        .where(and(eq(mcpTokens.userId, stored.userId), eq(mcpTokens.revoked, false)));
      throw new Error('Refresh token already used — session revoked');
    }
    if (stored.expiresAt < new Date()) {
      throw new Error('Refresh token expired');
    }

    // Rotate: mint a new refresh token, revoke the old one pointing at the new.
    const newRaw = randomBytes(32).toString('hex');
    const newHash = this.hashToken(newRaw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.db.transaction(async (tx) => {
      await tx
        .insert(mcpTokens)
        .values({ userId: stored.userId, tokenHash: newHash, expiresAt });
      await tx
        .update(mcpTokens)
        .set({ revoked: true, revokedAt: new Date(), replacedByHash: newHash })
        .where(eq(mcpTokens.tokenHash, tokenHash));
    });

    const accessToken = this.signAccessToken(stored.userId, client.client_id);
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: 'mcp',
      refresh_token: newRaw,
    };
  }

  verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        type?: string;
        clientId?: string;
        exp?: number;
      }>(token);

      if (payload.type !== 'mcp_access') {
        return Promise.reject(new Error('Not an MCP access token'));
      }

      return Promise.resolve({
        token,
        clientId: payload.clientId ?? 'unknown',
        scopes: ['mcp'],
        expiresAt: payload.exp,
        extra: { userId: payload.sub },
      });
    } catch {
      return Promise.reject(new Error('Invalid access token'));
    }
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    // Only refresh tokens are persisted; access tokens are stateless JWTs that
    // expire within the hour, so there's nothing to revoke for those.
    const tokenHash = this.hashToken(request.token);
    await this.db
      .update(mcpTokens)
      .set({ revoked: true, revokedAt: new Date() })
      .where(eq(mcpTokens.tokenHash, tokenHash));
  }

  // --- helpers ---

  private signAccessToken(userId: string, clientId: string): string {
    return this.jwtService.sign(
      { sub: userId, type: 'mcp_access', scope: 'mcp', clientId },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
  }

  private async issueTokens(userId: string, clientId: string): Promise<OAuthTokens> {
    const refreshRaw = randomBytes(32).toString('hex');
    const refreshHash = this.hashToken(refreshRaw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.db
      .insert(mcpTokens)
      .values({ userId, tokenHash: refreshHash, expiresAt });

    return {
      access_token: this.signAccessToken(userId, clientId),
      token_type: 'bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      scope: 'mcp',
      refresh_token: refreshRaw,
    };
  }
}
