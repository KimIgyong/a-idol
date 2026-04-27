import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminRole } from '@a-idol/shared';
import { AdminJwtTokenService } from '../../modules/admin-ops/infrastructure/admin-jwt-token.service';

export interface CurrentAdminContext {
  id: string;
  role: AdminRole;
}

/**
 * Bearer JWT guard for admin routes. Rejects non-admin access tokens
 * (i.e. tokens signed with type !== 'admin-access') and attaches
 * `req.admin = { id, role }` on success.
 */
@Injectable()
export class AdminJwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: AdminJwtTokenService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: CurrentAdminContext }>();
    const header = req.headers.authorization ?? '';
    const [, token] = header.match(/^Bearer\s+(.+)$/i) ?? [];
    if (!token) throw new UnauthorizedException('Missing Bearer token');
    try {
      const payload = await this.jwt.verifyAccess(token);
      req.admin = { id: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid admin access token');
    }
  }
}
