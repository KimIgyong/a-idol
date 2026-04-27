import { useState } from 'react';
import { ApiError } from '@/lib/api';

/**
 * Single-line error renderer with an optional correlation-id trailer for
 * unexpected errors (5xx / network). Per ADR-017 the id only shows up when
 * it would actually help a support engineer — 4xx business-rule errors
 * already tell the user what went wrong.
 *
 * Click the id to copy the full UUID to the clipboard.
 */
export function ErrorLine({
  error,
  prefix,
}: {
  error: unknown;
  /** Short label to prepend the message — e.g. "상태 변경 실패" */
  prefix?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!error) return null;

  const message = error instanceof Error ? error.message : String(error);
  const apiErr = error instanceof ApiError ? error : null;
  // Match the client-side policy: surface the id only when the failure is
  // server-side or network (the id is already in our logs there). Expected
  // 4xx errors (domain rules) don't need the trailer.
  const showId =
    apiErr &&
    apiErr.requestId &&
    (!apiErr.status || apiErr.status >= 500);

  const copy = async () => {
    if (!apiErr?.requestId) return;
    try {
      await navigator.clipboard.writeText(apiErr.requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked in dev / older browsers — ignore
    }
  };

  return (
    <div className="flex flex-wrap items-baseline gap-2 text-sm text-red-700">
      <span>
        {prefix ? <span className="font-semibold">{prefix}: </span> : null}
        {message}
      </span>
      {showId && apiErr ? (
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 font-mono text-[10px] text-red-500 underline decoration-dotted hover:text-red-700"
          title="클릭하면 클립보드에 복사됩니다"
        >
          {copied ? '✓ 복사됨' : `요청 ID: ${shortTrace(apiErr.requestId ?? '')}`}
        </button>
      ) : null}
    </div>
  );
}

function shortTrace(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}…${id.slice(-8)}`;
}
