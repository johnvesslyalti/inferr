import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async validateAndUpsertGoogleUser(googleProfile: any): Promise<User> {
    const user = await this.usersService.upsert(googleProfile);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.usersService.findById(id);
  }
}
