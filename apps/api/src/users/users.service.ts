import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DrizzleDB } from '../db/drizzle.provider';
import { users, User, NewUser } from '../db/schema';

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

    const [created] = await this.db.insert(users).values(newUser).returning();
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
}
