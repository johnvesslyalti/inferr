import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './google.strategy';
import { GoogleMcpStrategy } from './google-mcp.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { McpAuthModule } from '../mcp/mcp-auth.module';

@Module({
  imports: [
    PassportModule,
    forwardRef(() => UsersModule),
    McpAuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AuthService, GoogleStrategy, GoogleMcpStrategy, JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
