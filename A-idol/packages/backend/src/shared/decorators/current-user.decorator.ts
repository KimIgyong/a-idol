import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface CurrentUserContext {
  id: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentUserContext => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: CurrentUserContext }>();
  if (!req.user) {
    throw new Error('CurrentUser decorator used without JwtAuthGuard');
  }
  return req.user;
});
