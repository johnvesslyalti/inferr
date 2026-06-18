import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { users, userInterests, User, NewUser } from '../db/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async upsert(googleProfile: {
    id: string;
    displayName: string;
    emails: { value: string }[];
    photos: { value: string }[];
  }): Promise<User> {
    const email = googleProfile.emails[0]?.value || '';
    const avatar: string | null = googleProfile.photos[0]?.value || null;

    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.googleId, googleProfile.id))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(users)
        .set({ email, name: googleProfile.displayName, avatar })
        .where(eq(users.googleId, googleProfile.id))
        .returning();
      return updated;
    }

    const newUser: NewUser = {
      googleId: googleProfile.id,
      email,
      name: googleProfile.displayName,
      avatar,
    };

    const created = await this.db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values(newUser).returning();
      await tx.insert(userInterests).values({
        userId: user.id,
        tags: [],
        queryEmbedding: null,
      });
      return user;
    });

    return created;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);
    return result[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async saveInterests(userId: string, tags: string[]): Promise<void> {
    await this.db
      .insert(userInterests)
      .values({ userId, tags, queryEmbedding: null })
      .onConflictDoUpdate({
        target: userInterests.userId,
        set: { tags, queryEmbedding: null },
      });
  }

  async getInterests(userId: string): Promise<{ tags: string[] }> {
    const result = await this.db
      .select({ tags: userInterests.tags })
      .from(userInterests)
      .where(eq(userInterests.userId, userId))
      .limit(1);
    return { tags: result[0]?.tags ?? [] };
  }

  async hasInterests(userId: string): Promise<boolean> {
    const result = await this.db
      .select({ tags: userInterests.tags })
      .from(userInterests)
      .where(eq(userInterests.userId, userId))
      .limit(1);
    return (result[0]?.tags?.length ?? 0) > 0;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }
}
