"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = exports.AppError = exports.DomainError = void 0;
/**
 * Business rule violation. Maps to HTTP 4xx by the presentation layer.
 */
class DomainError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message ?? code);
        this.code = code;
        this.details = details;
        this.name = 'DomainError';
    }
}
exports.DomainError = DomainError;
/**
 * System / unexpected error. Maps to HTTP 5xx.
 */
class AppError extends Error {
    code;
    cause;
    constructor(code, message, cause) {
        super(message ?? code);
        this.code = code;
        this.cause = cause;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
// Known domain error codes used across modules (keep in sync with docs/design)
exports.ErrorCodes = {
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
};
//# sourceMappingURL=errors.js.map