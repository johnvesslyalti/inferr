import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { refreshTokens } from '../db/schema';
import type { User } from '../db/schema';

const GRACE_WINDOW_MS = 5_000; // accept a just-rotated token for 5s (multi-tab safety)

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {}

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async validateAndUpsertGoogleUser(googleProfile: {
    id: string;
    displayName: string;
    emails: { value: string }[];
    photos: { value: string }[];
  }): Promise<User> {
    return this.usersService.upsert(googleProfile);
  }

  async getUserById(id: string): Promise<User | null> {
    return this.usersService.findById(id);
  }

  signAccessToken(user: User): string {
    const payload = { sub: user.id, email: user.email, name: user.name };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  async createRefreshToken(userId: string): Promise<string> {
    const raw = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.db
      .insert(refreshTokens)
      .values({ userId, token: tokenHash, expiresAt });
    return raw; // raw token goes into the cookie; only the hash is persisted
  }

  async rotateRefreshToken(
    rawToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = this.hashToken(rawToken);

    const result = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, tokenHash))
      .limit(1);

    const stored = result[0];

    if (!stored) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Reuse detection: if revoked within the grace window, the client probably
    // sent the old token before receiving the rotated cookie (e.g. two tabs
    // loading simultaneously). Issue a fresh rotation from the replacement.
    if (stored.revoked) {
      const revokedRecently =
        stored.revokedAt !== null &&
        stored.revokedAt !== undefined &&
        Date.now() - stored.revokedAt.getTime() < GRACE_WINDOW_MS;

      if (revokedRecently && stored.replacedByHash) {
        const replacementResult = await this.db
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.token, stored.replacedByHash))
          .limit(1);

        const replacement = replacementResult[0];
        if (
          replacement &&
          !replacement.revoked &&
          replacement.expiresAt > new Date()
        ) {
          const user = await this.usersService.findById(replacement.userId);
          if (!user) throw new UnauthorizedException('User not found');

          // Rotate the replacement token so the stale tab gets a fresh one
          const newRaw = crypto.randomBytes(64).toString('hex');
          const newHash = this.hashToken(newRaw);
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          await this.db
            .insert(refreshTokens)
            .values({ userId: user.id, token: newHash, expiresAt });
          await this.db
            .update(refreshTokens)
            .set({
              revoked: true,
              revokedAt: new Date(),
              replacedByHash: newHash,
            })
            .where(eq(refreshTokens.token, stored.replacedByHash));

          return {
            accessToken: this.signAccessToken(user),
            refreshToken: newRaw,
          };
        }
      }

      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Normal rotation
    const newRaw = crypto.randomBytes(64).toString('hex');
    const newHash = this.hashToken(newRaw);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.db
      .insert(refreshTokens)
      .values({ userId: stored.userId, token: newHash, expiresAt });
    await this.db
      .update(refreshTokens)
      .set({ revoked: true, revokedAt: new Date(), replacedByHash: newHash })
      .where(eq(refreshTokens.token, tokenHash));

    const user = await this.usersService.findById(stored.userId);
    if (!user) throw new UnauthorizedException('User not found');

    return { accessToken: this.signAccessToken(user), refreshToken: newRaw };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.db
      .update(refreshTokens)
      .set({ revoked: true, revokedAt: new Date() })
      .where(eq(refreshTokens.token, tokenHash));
  }
}
