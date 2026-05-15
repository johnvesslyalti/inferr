import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './google.strategy';
import { GoogleTokenGuard } from './google-token.guard';

@Module({
  imports: [PassportModule, UsersModule],
  providers: [AuthService, GoogleStrategy, GoogleTokenGuard],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
