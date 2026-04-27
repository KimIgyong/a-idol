import { useCallback, useState } from 'react';
import { apiFetch, invalidateEtagCache } from '@/lib/api';
import { useAuthStore } from './auth-store';

/**
 * RPT-260426-D Phase D T-082 — admin server-side session revoke.
 *
 * 모바일 signOut과 동일 패턴: refresh token으로 `/api/v1/admin/auth/logout` 호출
 * → server-side session 즉시 revoke. 네트워크 실패해도 로컬 store는 무조건
 * 비워 사용자가 logged out 상태가 되도록.
 */
export function useLogout(): { logout: () => Promise<void>; pending: boolean } {
  const session = useAuthStore((s) => s.session);
  const clear = useAuthStore((s) => s.clear);
  const [pending, setPending] = useState(false);

  const logout = useCallback(async () => {
    setPending(true);
    try {
      const rt = session?.refreshToken;
      if (rt) {
        try {
          await apiFetch<{ revoked: boolean }>('/api/v1/admin/auth/logout', {
            method: 'POST',
            body: { refreshToken: rt },
          });
        } catch {
          // 무시 — server-side revoke 실패해도 token expiry로 자연 만료.
        }
      }
      invalidateEtagCache();
      clear();
    } finally {
      setPending(false);
    }
  }, [session, clear]);

  return { logout, pending };
}
