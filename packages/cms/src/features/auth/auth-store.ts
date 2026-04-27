import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminAuthResponseDto, AdminRole } from '@a-idol/shared';

export type AuthSession = AdminAuthResponseDto;

interface AuthState {
  session: AuthSession | null;
  setSession: (session: AuthSession) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clear: () => set({ session: null }),
    }),
    { name: 'a-idol.cms.auth' },
  ),
);

export function hasRole(session: AuthSession | null, ...allowed: AdminRole[]): boolean {
  return !!session && allowed.includes(session.user.role);
}
