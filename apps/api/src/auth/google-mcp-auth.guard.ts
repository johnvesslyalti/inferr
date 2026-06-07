import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Guard for the `'google-mcp'` strategy that forwards the incoming `state`
 * query param into Passport's authenticate options, so it is included in the
 * Google authorization redirect and echoed back on the callback. This is how
 * the MCP authorization state survives the round-trip through Google.
 */
@Injectable()
export class GoogleMcpAuthGuard extends AuthGuard('google-mcp') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const state = (req.query?.state as string | undefined) ?? undefined;
    return { state };
  }
}
