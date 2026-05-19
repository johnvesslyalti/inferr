import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import type { User } from '../db/schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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
}
