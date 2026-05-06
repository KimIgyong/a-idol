import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { Request, Response } from 'express';

/**
 * Maps DomainError codes to HTTP status codes.
 * Anything that isn't a DomainError or HttpException becomes a 500.
 *
 * 5xx capture (T-082 후속 — RPT-260426-D Phase D):
 *  - generic Error → 500 + 풀 stack + request 컨텍스트(method/url/reqId/userId)
 *  - HttpException 5xx → 동일 capture (NestJS 자체 throw도 staging 추적)
 *  - DomainError → 4xx 매핑이 default라 5xx 경로 미진입 (기록 미필요)
 *
 * Sentry 등 외부 sink 도입 전 stage 임 — pino `error` 레벨로 기록되어 reqId
 * grep 으로 traceable. ADR-017과 정합.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<
      Request & {
        id?: string;
        user?: { id?: string };
      }
    >();

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
      if (status >= 500) {
        this.captureServerError(req, status, exception);
      }
      const payload = exception.getResponse();
      return res.status(status).json(typeof payload === 'object' ? payload : { message: payload });
    }

    const err = exception as Error;
    this.captureServerError(req, HttpStatus.INTERNAL_SERVER_ERROR, err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }

  /**
   * 5xx 발생 시 stack + request 컨텍스트를 한 번에 기록. pino structured log
   * 가 pickup → ELK/Datadog에서 reqId 로 user-side 요청과 매칭 가능. Sentry
   * SDK가 init된 경우 captureException 도 함께 (DSN 미설정 시 graceful no-op).
   */
  private captureServerError(
    req: Request & { id?: string; user?: { id?: string } },
    status: number,
    err: Error,
  ): void {
    const reqId = req.id ?? '-';
    const userId = req.user?.id ?? '-';
    this.log.error(
      `[5xx ${status}] ${req.method} ${req.url} reqId=${reqId} userId=${userId} | ${err.stack ?? err.message}`,
    );
    // T-080 Sentry — Sentry.init 호출 안 됐으면 internal hub가 NoopClient를
    // 사용해 graceful pass. captureException 자체는 항상 안전 호출.
    Sentry.captureException(err, {
      tags: {
        statusCode: String(status),
        method: req.method,
        route: req.url,
      },
      extra: { reqId, userId },
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
      case ErrorCodes.AGENCY_HAS_IDOLS:
      case ErrorCodes.IDOL_ALREADY_IN_AUDITION:
      case ErrorCodes.AUDITION_INVALID_TRANSITION:
      case ErrorCodes.ROUND_INVALID_TRANSITION:
      case ErrorCodes.AUDITION_MUST_BE_DRAFT:
      case ErrorCodes.AUDITION_NOT_ACTIVE:
      case ErrorCodes.ADMIN_EMAIL_DUPLICATE:
      case ErrorCodes.ADMIN_LIMIT_EXCEEDED:
      case ErrorCodes.ADMIN_LAST_ADMIN_DEMOTION:
        return HttpStatus.CONFLICT;
      case ErrorCodes.UNDER_AGE:
      case ErrorCodes.BREACHED_PASSWORD:
      case ErrorCodes.CHAT_MESSAGE_TOO_LONG:
      case ErrorCodes.AUDITION_INVALID_DATE_RANGE:
      case ErrorCodes.VOTE_RULE_INVALID_WEIGHTS:
      case ErrorCodes.ISSUE_INVALID_DATE_RANGE:
        return HttpStatus.UNPROCESSABLE_ENTITY;
      case ErrorCodes.INVALID_RECEIPT:
        // IAP receipt verification failure — caller sent a malformed /
        // expired / wrong-env JWS. 400 matches ADR-019 §3 lifecycle.
        return HttpStatus.BAD_REQUEST;
      case ErrorCodes.NO_COUPON:
      case ErrorCodes.NOT_ENOUGH_TICKETS:
      case ErrorCodes.PAID_FAN_CLUB_NOT_SUPPORTED:
        return HttpStatus.PAYMENT_REQUIRED;
      case ErrorCodes.CHAT_GATE_NOT_MEMBER:
      case ErrorCodes.VOTE_ROUND_NOT_ACTIVE:
      case ErrorCodes.VOTE_METHOD_NOT_ALLOWED:
      case ErrorCodes.IDOL_NOT_IN_AUDITION:
      case ErrorCodes.IDOL_ELIMINATED:
      case ErrorCodes.ADMIN_SELF_MODIFICATION_FORBIDDEN:
      case ErrorCodes.NOTE_FORBIDDEN:
        return HttpStatus.FORBIDDEN;
      case ErrorCodes.VOTE_DAILY_LIMIT_EXCEEDED:
        return HttpStatus.TOO_MANY_REQUESTS;
      case ErrorCodes.ACCOUNT_LOCKED:
        // 423 Locked — RFC 4918. NestJS HttpStatus enum 미정의 라 숫자 직접.
        // Retry-After 헤더는 별도 슬라이스에서 보강.
        return 423;
      case ErrorCodes.ATTACHMENT_TOO_LARGE:
        return HttpStatus.PAYLOAD_TOO_LARGE;
      case ErrorCodes.ATTACHMENT_MIME_NOT_ALLOWED:
        return HttpStatus.UNSUPPORTED_MEDIA_TYPE;
      case ErrorCodes.IDOL_NOT_FOUND:
      case ErrorCodes.AGENCY_NOT_FOUND:
      case ErrorCodes.FAN_CLUB_NOT_FOUND:
      case ErrorCodes.CHAT_ROOM_NOT_FOUND:
      case ErrorCodes.AUTO_MESSAGE_NOT_FOUND:
      case ErrorCodes.AUDITION_NOT_FOUND:
      case ErrorCodes.ROUND_NOT_FOUND:
      case ErrorCodes.AUDITION_ENTRY_NOT_FOUND:
      case ErrorCodes.VOTE_RULE_NOT_FOUND:
      case ErrorCodes.SESSION_NOT_FOUND:
      case ErrorCodes.PHOTOCARD_SET_NOT_FOUND:
      case ErrorCodes.PHOTOCARD_SET_EMPTY:
      case ErrorCodes.PRODUCT_NOT_FOUND:
      case ErrorCodes.TRANSACTION_NOT_FOUND:
      case ErrorCodes.ADMIN_NOT_FOUND:
      case ErrorCodes.ATTACHMENT_NOT_FOUND:
      case ErrorCodes.NOTE_NOT_FOUND:
        return HttpStatus.NOT_FOUND;
      case ErrorCodes.AUTO_MESSAGE_PAST_SCHEDULE:
        return HttpStatus.UNPROCESSABLE_ENTITY;
      case ErrorCodes.AUTO_MESSAGE_ALREADY_DISPATCHED:
        return HttpStatus.CONFLICT;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }
}
