import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentAdminContext } from '../guards/admin-jwt.guard';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentAdminContext => {
    const req = ctx.switchToHttp().getRequest<Request & { admin?: CurrentAdminContext }>();
    if (!req.admin) {
      throw new Error('CurrentAdmin decorator used without AdminJwtAuthGuard');
    }
    return req.admin;
  },
);

export type { CurrentAdminContext } from '../guards/admin-jwt.guard';
