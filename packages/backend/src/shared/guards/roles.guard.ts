import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AdminRole } from '@a-idol/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { CurrentAdminContext } from './admin-jwt.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { admin?: CurrentAdminContext }>();
    if (!req.admin) throw new ForbiddenException('Admin context missing');
    if (!required.includes(req.admin.role)) {
      throw new ForbiddenException(`Requires role: ${required.join(' | ')}`);
    }
    return true;
  }
}
