import {
  Controller,
  Get,
  Post,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../users/users.service';

const isProduction = process.env.NODE_ENV === 'production';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('none' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const googleProfile = req.user as {
      id?: string;
      displayName?: string;
      emails?: { value: string }[];
      photos?: { value: string }[];
    };

    if (!googleProfile?.id) {
      throw new UnauthorizedException('Failed to authenticate with Google');
    }

    const user = await this.authService.validateAndUpsertGoogleUser({
      id: googleProfile.id,
      displayName: googleProfile.displayName ?? '',
      emails: googleProfile.emails ?? [],
      photos: googleProfile.photos ?? [],
    });
    const refreshToken = await this.authService.createRefreshToken(user.id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    return res.redirect(`${frontendUrl}/auth/callback`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    const user = req.user as
      | { id: string; email: string; name: string }
      | undefined;

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const hasInterests = await this.usersService.hasInterests(user.id);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      hasInterests,
    };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const oldToken = (req.cookies as Record<string, string | undefined>)[
      'refresh_token'
    ];

    if (!oldToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const { accessToken, refreshToken } =
      await this.authService.rotateRefreshToken(oldToken);

    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    return res.json({ accessToken });
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = (req.cookies as Record<string, string | undefined>)[
      'refresh_token'
    ];

    if (token) {
      await this.authService.revokeRefreshToken(token);
    }

    res.clearCookie('refresh_token', REFRESH_COOKIE_OPTIONS);
    return res.json({ message: 'Logged out' });
  }
}
