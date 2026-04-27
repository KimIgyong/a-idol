import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * NIST SP 800-63B §5.1.1.2 후속 — Have I Been Pwned (HIBP) "Pwned Passwords"
 * API 호출. RPT-260426-D Phase D T-082.
 *
 * **k-anonymity protocol**: 비밀번호 자체를 보내지 않고 SHA-1 해시의
 * 첫 5자만 전송. 응답으로 받은 N개 suffix 중 클라이언트가 매칭 — HIBP
 * 서버는 어떤 비번이 조회되었는지 모름.
 *
 *  - 외부 API: `https://api.pwnedpasswords.com/range/{first5}`
 *  - 응답: `text/plain` body, 줄당 `SUFFIX:COUNT` (count = 유출 횟수)
 *  - 매칭 시 → "weak / breached"
 *  - 미매칭 (또는 네트워크 실패) → graceful pass
 *
 * **운영 정책**:
 *  - dev/test: env `HIBP_CHECK_ENABLED=0` (기본 OFF) — 네트워크 의존성 없음
 *  - staging/prod: `HIBP_CHECK_ENABLED=1` — 네트워크 OK 시 검사
 *  - 네트워크 실패는 graceful — signup 차단 X (DoS 방지). pino warn 만 기록
 *  - timeout 1.5s — signup 응답성 우선
 */
@Injectable()
export class HibpPasswordChecker {
  private readonly log = new Logger(HibpPasswordChecker.name);
  private readonly enabled: boolean;
  private readonly endpoint: string;
  private readonly timeoutMs = 1500;

  constructor() {
    this.enabled = process.env.HIBP_CHECK_ENABLED === '1';
    this.endpoint = process.env.HIBP_API_BASE ?? 'https://api.pwnedpasswords.com';
  }

  /**
   * 비밀번호가 breach DB 에 있으면 true (signup 거부 신호). 네트워크 실패는
   * false (graceful — DoS 방지). 비활성화 모드에서는 false.
   */
  async isBreached(password: string): Promise<boolean> {
    if (!this.enabled) return false;
    if (typeof password !== 'string' || password.length === 0) return false;

    const hash = sha1Hex(password).toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), this.timeoutMs);
      const res = await fetch(`${this.endpoint}/range/${prefix}`, {
        signal: ac.signal,
        headers: { 'Add-Padding': 'true' }, // HIBP best practice — 응답 크기 정규화
      });
      clearTimeout(t);
      if (!res.ok) {
        this.log.warn(`HIBP returned ${res.status} for prefix=${prefix} — skipping check`);
        return false;
      }
      const body = await res.text();
      // body 는 "SUFFIX:COUNT\n" lines. 우리 suffix(35 chars)와 일치하는 line의
      // count > 0 이면 breached. 'Add-Padding=true' 응답에는 count=0 dummy
      // 라인이 섞여 있어 명시적으로 체크 필요.
      for (const raw of body.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const [s, cnt] = line.split(':');
        if (s === suffix && Number(cnt ?? '0') > 0) {
          return true;
        }
      }
      return false;
    } catch (err) {
      // AbortError, network error 등 — graceful 통과
      this.log.warn(
        `HIBP check failed for prefix=${prefix}: ${(err as Error).message}. Allowing signup.`,
      );
      return false;
    }
  }
}

function sha1Hex(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}
