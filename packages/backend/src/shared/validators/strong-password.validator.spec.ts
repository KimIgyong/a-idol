import { isWeakPassword } from '@a-idol/shared';

describe('isWeakPassword', () => {
  it('정확 일치하는 흔한 비밀번호 reject', () => {
    expect(isWeakPassword('password')).toBe(true);
    expect(isWeakPassword('PASSWORD')).toBe(true);
    expect(isWeakPassword('12345678')).toBe(true);
    expect(isWeakPassword('qwerty12')).toBe(true);
    expect(isWeakPassword('aidol123')).toBe(true);
  });

  it('짧은(≤12) 길이 + 흔한 root 포함 reject', () => {
    expect(isWeakPassword('mypassword!')).toBe(true);
    expect(isWeakPassword('admin12345')).toBe(true);
    expect(isWeakPassword('a-idol2026')).toBe(true);
  });

  it('passphrase (≥13자)는 root 포함되어도 통과', () => {
    expect(isWeakPassword('mypasswordisVeryLong')).toBe(false);
    expect(isWeakPassword('correct horse battery staple')).toBe(false);
  });

  it('blocklist 외 짧은 unique 조합은 통과', () => {
    expect(isWeakPassword('Tj92!xK4z')).toBe(false);
    expect(isWeakPassword('integration-pw-1234')).toBe(false);
    expect(isWeakPassword('Aaaaaa1!')).toBe(false);
  });

  it('non-string input은 보수적으로 weak 처리', () => {
    expect(isWeakPassword(null as unknown as string)).toBe(true);
    expect(isWeakPassword(undefined as unknown as string)).toBe(true);
    expect(isWeakPassword(12345678 as unknown as string)).toBe(true);
  });
});
