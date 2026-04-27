import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Resolve a request correlation ID: honor the caller's `X-Request-ID` header
 * if present, otherwise mint a UUID. Plugged into `pinoHttp.genReqId` so every
 * log line under this request carries it as `reqId`. Also echoes the final id
 * back on the response via `X-Request-ID` so clients (and curl users) can
 * reference the same id in bug reports.
 *
 * Used by the LoggerModule bootstrap in AppModule.
 */
export function resolveRequestId(
  req: IncomingMessage,
  res: ServerResponse,
): string {
  const incoming = req.headers['x-request-id'];
  const raw = Array.isArray(incoming) ? incoming[0] : incoming;
  const trimmed = raw?.trim();
  const id = trimmed && trimmed.length > 0 && trimmed.length <= 128 ? trimmed : randomUUID();
  res.setHeader('X-Request-ID', id);
  return id;
}
