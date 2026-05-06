/**
 * NIST SP 800-63B §5.1.1.2 정렬 — "memorized secrets shall be checked against
 * a list that contains values known to be commonly-used, expected, or
 * compromised". HIBP 같은 외부 breach DB 통합은 별도 슬라이스로, 일단 self-
 * contained blocklist 로 가장 흔한 패턴 차단.
 *
 * 기준:
 *  - 정확 일치 (대소문자 무관 비교)
 *  - "password" 류 root 가 들어있고 길이 ≤ 12 → reject (e.g. "password123")
 *
 * 길이 ≥ 12 인 passphrase 는 통과 (NIST 권장 — 강제 복잡도 대신 길이).
 *
 * identity / admin-ops 등 비밀번호를 받는 모든 모듈에서 공유.
 */

const COMMON_BLOCKLIST = [
  'password',
  'p@ssword',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty12',
  'qwerty123',
  'abc12345',
  'abcd1234',
  'admin123',
  'admin1234',
  'letmein1',
  'welcome1',
  'iloveyou',
  '11111111',
  '00000000',
  'aaaaaaaa',
  'monkey12',
  'football',
  'baseball',
  'dragon123',
  'master12',
  'sunshine',
  'princess',
  'shadow12',
  'superman',
  'trustno1',
  'qazwsx12',
  'a-idol12',
  'aidol123',
];

const COMMON_ROOTS = ['password', 'qwerty', 'iloveyou', 'admin', 'a-idol', 'aidol'];

export function isWeakPassword(value: string): boolean {
  if (typeof value !== 'string') return true;
  const lower = value.toLowerCase();
  if (COMMON_BLOCKLIST.includes(lower)) return true;
  if (value.length <= 12) {
    for (const root of COMMON_ROOTS) {
      if (lower.includes(root)) return true;
    }
  }
  return false;
}
