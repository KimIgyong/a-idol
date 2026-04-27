import { useMutation } from '@tanstack/react-query';
import type { AdminAuthResponseDto } from '@a-idol/shared';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from './auth-store';

export interface LoginInput {
  email: string;
  password: string;
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<AdminAuthResponseDto>('/api/v1/admin/auth/login', {
        method: 'POST',
        body: input,
      }),
    onSuccess: (session) => setSession(session),
  });
}
