import { HibpPasswordChecker } from './hibp-password-checker';

/**
 * T-PWD-HIBP — k-anonymity API 응답 처리 단위 테스트.
 *
 * 글로벌 fetch를 mock하여 외부 의존성 없이 동작 검증.
 *  - SHA-1 prefix 5자 추출
 *  - suffix 매칭 + count > 0 → breached
 *  - 미매칭 / network fail → graceful pass
 */
describe('HibpPasswordChecker', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  function withFetch(impl: typeof fetch) {
    global.fetch = impl as unknown as typeof fetch;
  }

  it('비활성화(env 미설정) 시 외부 호출 없이 false', async () => {
    delete process.env.HIBP_CHECK_ENABLED;
    const fetchMock = jest.fn();
    withFetch(fetchMock as unknown as typeof fetch);
    const checker = new HibpPasswordChecker();
    await expect(checker.isBreached('whatever')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('활성화 + suffix 매칭 + count>0 → true', async () => {
    process.env.HIBP_CHECK_ENABLED = '1';
    // "password"의 SHA-1 = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // prefix = 5BAA6, suffix = 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    const expectedPrefix = '5BAA6';
    const matchingSuffix = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';
    withFetch(async (url) => {
      expect(String(url)).toContain(`/range/${expectedPrefix}`);
      return new Response(`${matchingSuffix}:9999999\nABCDEF:0\n`, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    });
    const checker = new HibpPasswordChecker();
    await expect(checker.isBreached('password')).resolves.toBe(true);
  });

  it('활성화 + suffix 미매칭 → false', async () => {
    process.env.HIBP_CHECK_ENABLED = '1';
    withFetch(async () =>
      new Response('ZZZZZZ:1\nDEADBEEF:42\n', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );
    const checker = new HibpPasswordChecker();
    await expect(checker.isBreached('not-in-list-12345')).resolves.toBe(false);
  });

  it('활성화 + suffix 매칭 but count=0 (padding) → false', async () => {
    process.env.HIBP_CHECK_ENABLED = '1';
    // "password" suffix
    const matchingSuffix = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';
    withFetch(async () =>
      new Response(`${matchingSuffix}:0\nOTHER:0\n`, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );
    const checker = new HibpPasswordChecker();
    await expect(checker.isBreached('password')).resolves.toBe(false);
  });

  it('활성화 + 네트워크 실패 → graceful false', async () => {
    process.env.HIBP_CHECK_ENABLED = '1';
    withFetch(async () => {
      throw new Error('ECONNRESET');
    });
    const checker = new HibpPasswordChecker();
    await expect(checker.isBreached('password')).resolves.toBe(false);
  });

  it('활성화 + 5xx 응답 → graceful false', async () => {
    process.env.HIBP_CHECK_ENABLED = '1';
    withFetch(async () => new Response('boom', { status: 503 }));
    const checker = new HibpPasswordChecker();
    await expect(checker.isBreached('password')).resolves.toBe(false);
  });
});
