/**
 * Business rule violation. Maps to HTTP 4xx by the presentation layer.
 */
export declare class DomainError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown>;
    constructor(code: string, message?: string, details?: Record<string, unknown>);
}
/**
 * System / unexpected error. Maps to HTTP 5xx.
 */
export declare class AppError extends Error {
    readonly code: string;
    readonly cause?: unknown | undefined;
    constructor(code: string, message?: string, cause?: unknown | undefined);
}
export declare const ErrorCodes: {
    readonly INVALID_CREDENTIAL: "INVALID_CREDENTIAL";
    readonly EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS";
    readonly UNDER_AGE: "UNDER_AGE";
    readonly SESSION_NOT_FOUND: "SESSION_NOT_FOUND";
    readonly INVALID_REFRESH_TOKEN: "INVALID_REFRESH_TOKEN";
    readonly FAN_CLUB_NOT_FOUND: "FAN_CLUB_NOT_FOUND";
    readonly ALREADY_MEMBER: "ALREADY_MEMBER";
    readonly NO_COUPON: "NO_COUPON";
    readonly DUPLICATE_RECEIPT: "DUPLICATE_RECEIPT";
    readonly NOT_ENOUGH_TICKETS: "NOT_ENOUGH_TICKETS";
    readonly ROUND_CLOSED: "ROUND_CLOSED";
};
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
//# sourceMappingURL=errors.d.ts.map