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
    // jsonwebtoken 의 TokenExpiredError / JsonWebTokenError 는 그대로 던지면
    // AppExceptionFilter 에서 500 으로 처리되어 모바일 클라이언트의 401 →
    // refresh-token 재시도 분기를 타지 못한다. UnauthorizedException 으로 wrap.
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAccess(token);
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'TokenExpiredError'
          ? 'token_expired'
          : 'invalid_token';
      throw new UnauthorizedException(code);
    }
    req.user = { id: payload.sub };
    return true;
  }
}
