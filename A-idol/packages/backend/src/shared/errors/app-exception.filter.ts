import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { Response } from 'express';

/**
 * Maps DomainError codes to HTTP status codes.
 * Anything that isn't a DomainError or HttpException becomes a 500.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      const status = this.mapDomainCode(exception.code);
      return res.status(status).json({
        code: exception.code,
        message: exception.message,
        details: exception.details,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      return res.status(status).json(typeof payload === 'object' ? payload : { message: payload });
    }

    const err = exception as Error;
    this.log.error(err.stack ?? err.message);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }

  private mapDomainCode(code: string): number {
    switch (code) {
      case ErrorCodes.INVALID_CREDENTIAL:
      case ErrorCodes.INVALID_REFRESH_TOKEN:
        return HttpStatus.UNAUTHORIZED;
      case ErrorCodes.EMAIL_ALREADY_EXISTS:
      case ErrorCodes.ALREADY_MEMBER:
      case ErrorCodes.ROUND_CLOSED:
      case ErrorCodes.DUPLICATE_RECEIPT:
        return HttpStatus.CONFLICT;
      case ErrorCodes.UNDER_AGE:
        return HttpStatus.UNPROCESSABLE_ENTITY;
      case ErrorCodes.NO_COUPON:
      case ErrorCodes.NOT_ENOUGH_TICKETS:
        return HttpStatus.PAYMENT_REQUIRED;
      case ErrorCodes.FAN_CLUB_NOT_FOUND:
      case ErrorCodes.SESSION_NOT_FOUND:
        return HttpStatus.NOT_FOUND;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }
}
