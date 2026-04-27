import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

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

/**
 * @internal 테스트와 사용처를 위해 export. 컨트롤러에서 직접 호출 가능.
 */
export function isWeakPassword(value: string): boolean {
  if (typeof value !== 'string') return true;
  const lower = value.toLowerCase();
  // 정확 일치
  if (COMMON_BLOCKLIST.includes(lower)) return true;
  // 짧은 길이(≤12) + 흔한 root 포함 — passphrase 예외 (≥13자)
  if (value.length <= 12) {
    for (const root of COMMON_ROOTS) {
      if (lower.includes(root)) return true;
    }
  }
  return false;
}

export function IsStrongPassword(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && !isWeakPassword(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property}는 흔한 패턴이거나 추측되기 쉽습니다. 13자 이상 passphrase 또는 더 고유한 조합을 사용해 주세요.`;
        },
      },
    });
  };
}
