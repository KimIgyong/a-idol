import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveRequestId } from './correlation';

function makeReqRes(headers: Record<string, string | string[] | undefined>) {
  const req = { headers } as unknown as IncomingMessage;
  const setHeader = jest.fn();
  const res = { setHeader } as unknown as ServerResponse;
  return { req, res, setHeader };
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('resolveRequestId', () => {
  it('TC-REQID001 — no header → mints UUID and echoes it', () => {
    const { req, res, setHeader } = makeReqRes({});
    const id = resolveRequestId(req, res);
    expect(id).toMatch(UUID_V4);
    expect(setHeader).toHaveBeenCalledWith('X-Request-ID', id);
  });

  it('TC-REQID002 — header provided → preserves it verbatim', () => {
    const { req, res, setHeader } = makeReqRes({ 'x-request-id': 'client-trace-abc' });
    const id = resolveRequestId(req, res);
    expect(id).toBe('client-trace-abc');
    expect(setHeader).toHaveBeenCalledWith('X-Request-ID', 'client-trace-abc');
  });

  it('TC-REQID003 — array header → takes the first value', () => {
    const { req, res } = makeReqRes({ 'x-request-id': ['first', 'second'] });
    expect(resolveRequestId(req, res)).toBe('first');
  });

  it('TC-REQID004 — blank / whitespace header → falls back to UUID', () => {
    const { req, res } = makeReqRes({ 'x-request-id': '   ' });
    expect(resolveRequestId(req, res)).toMatch(UUID_V4);
  });

  it('TC-REQID005 — absurdly long id (>128 chars) → rejected, UUID assigned', () => {
    const tooLong = 'x'.repeat(256);
    const { req, res } = makeReqRes({ 'x-request-id': tooLong });
    const id = resolveRequestId(req, res);
    expect(id).not.toBe(tooLong);
    expect(id).toMatch(UUID_V4);
  });

  it('TC-REQID006 — trims surrounding whitespace on accepted id', () => {
    const { req, res } = makeReqRes({ 'x-request-id': '  trace-1  ' });
    expect(resolveRequestId(req, res)).toBe('trace-1');
  });
});
