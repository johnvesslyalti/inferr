import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { McpOAuthProvider } from './mcp-oauth.provider';

/**
 * Standalone module for the MCP OAuth provider.
 *
 * It deliberately depends on nothing but `JwtModule` (and the global `DRIZZLE`
 * provider). Both `AuthModule` (which injects the provider into AuthController)
 * and `McpModule` (which injects it into McpController) import THIS module
 * instead of each other — breaking what would otherwise be a circular
 * dependency between AuthModule and McpModule.
 */
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
  ],
  providers: [McpOAuthProvider],
  exports: [McpOAuthProvider],
})
export class McpAuthModule {}
