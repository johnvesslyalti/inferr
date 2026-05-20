import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { refreshTokens } from '../db/schema';
import type { User } from '../db/schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {}

  async validateAndUpsertGoogleUser(googleProfile: any): Promise<User> {
    const user = await this.usersService.upsert(googleProfile);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.usersService.findById(id);
  }

  signAccessToken(user: User): string {
    const payload = { sub: user.id, email: user.email, name: user.name };
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.db.insert(refreshTokens).values({ userId, token, expiresAt });
    return token;
  }

  async rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const result = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, oldToken))
      .limit(1);

    const stored = result[0];

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token
    await this.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.token, oldToken));

    const user = await this.usersService.findById(stored.userId);
    if (!user) throw new UnauthorizedException('User not found');

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.token, token));
  }
}
