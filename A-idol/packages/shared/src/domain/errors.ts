/**
 * Business rule violation. Maps to HTTP 4xx by the presentation layer.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}

/**
 * System / unexpected error. Maps to HTTP 5xx.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly cause?: unknown,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

// Known domain error codes used across modules (keep in sync with docs/design)
export const ErrorCodes = {
  // identity
  INVALID_CREDENTIAL: 'INVALID_CREDENTIAL',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  UNDER_AGE: 'UNDER_AGE',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  // fandom
  FAN_CLUB_NOT_FOUND: 'FAN_CLUB_NOT_FOUND',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  // chat
  NO_COUPON: 'NO_COUPON',
  // commerce
  DUPLICATE_RECEIPT: 'DUPLICATE_RECEIPT',
  // audition
  NOT_ENOUGH_TICKETS: 'NOT_ENOUGH_TICKETS',
  ROUND_CLOSED: 'ROUND_CLOSED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
