import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import type { User } from '../db/schema';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('interests')
  @UseGuards(JwtAuthGuard)
  async getInterests(@Req() req: Request) {
    const user = req.user as User;
    return this.usersService.getInterests(user.id);
  }

  @Post('interests')
  @UseGuards(JwtAuthGuard)
  async saveInterests(@Req() req: Request, @Body() body: { tags: string[] }) {
    const user = req.user as User;
    await this.usersService.saveInterests(user.id, body.tags ?? []);
    return { ok: true };
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: Request) {
    const user = req.user as User;
    await this.usersService.deleteUser(user.id);
    return { ok: true };
  }
}
