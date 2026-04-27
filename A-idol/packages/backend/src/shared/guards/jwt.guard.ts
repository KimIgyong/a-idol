import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtTokenService } from '../../modules/identity/infrastructure/jwt-token.service';

/**
 * Simple Bearer JWT guard. Attaches `req.user = { id, ... }` on success.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtTokenService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const header = req.headers.authorization ?? '';
    const [, token] = header.match(/^Bearer\s+(.+)$/i) ?? [];
    if (!token) throw new UnauthorizedException('Missing Bearer token');
    const payload = await this.jwt.verifyAccess(token);
    req.user = { id: payload.sub };
    return true;
  }
}
