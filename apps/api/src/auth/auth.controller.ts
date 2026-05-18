import {
  Controller,
  Get,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleTokenGuard } from './google-token.guard';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private usersService: UsersService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const googleProfile = (req.user as any) || {};

    if (!googleProfile.id) {
      throw new UnauthorizedException('Failed to authenticate with Google');
    }

    const user = await this.authService.validateAndUpsertGoogleUser(googleProfile);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    return res.redirect(`${frontendUrl}/auth/callback?token=${user.id}`);
  }

  @Get('me')
  @UseGuards(GoogleTokenGuard)
  async getProfile(@Req() req: Request) {
    const user = (req.user as any);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const hasInterests = await this.usersService.hasInterests(user.id);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      hasInterests,
    };
  }
}
