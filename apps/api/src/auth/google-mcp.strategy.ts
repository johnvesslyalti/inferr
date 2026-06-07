import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions } from 'passport-google-oauth20';

/**
 * A second Google OAuth strategy used only by the MCP authorization flow.
 *
 * It is identical to {@link GoogleStrategy} except for the strategy name and
 * the callback URL, which returns to `/auth/google/mcp-callback`. This lets the
 * MCP flow carry its own `state` and complete an MCP authorization without
 * disturbing the web-app login (which keeps using the `'google'` strategy).
 */
@Injectable()
export class GoogleMcpStrategy extends PassportStrategy(Strategy, 'google-mcp') {
  constructor() {
    const options: StrategyOptions = {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL:
        process.env.GOOGLE_MCP_CALLBACK_URL ||
        'http://localhost:3001/auth/google/mcp-callback',
      scope: ['email', 'profile'],
    };
    super(options);
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      displayName: string;
      emails: { value: string }[];
      photos: { value: string }[];
    },
  ) {
    return {
      id: profile.id,
      displayName: profile.displayName,
      emails: profile.emails,
      photos: profile.photos,
    };
  }
}
