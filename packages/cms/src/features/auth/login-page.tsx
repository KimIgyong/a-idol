import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useAuthStore } from './auth-store';
import { useLogin } from './use-login';

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해 주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상입니다.'),
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const session = useAuthStore((s) => s.session);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (session) {
    const to = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={to} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      const to = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(to, { replace: true });
    } catch {
      // surfaced via login.error below
    }
  });

  const serverMessage = (() => {
    if (!login.error) return null;
    if (!(login.error instanceof ApiError)) {
      return '로그인 중 오류가 발생했습니다.';
    }
    // T-082 ACCOUNT_LOCKED — 친절 안내 (NIST §5.2.2 lockout)
    if (login.error.code === 'ACCOUNT_LOCKED') {
      const retryAfterSec = (login.error.details as { retryAfterSec?: number } | undefined)
        ?.retryAfterSec;
      const minutes = retryAfterSec ? Math.ceil(retryAfterSec / 60) : null;
      return minutes
        ? `너무 많은 로그인 실패로 관리자 계정이 일시 잠겼습니다. 약 ${minutes}분 후 다시 시도해 주세요.`
        : '너무 많은 로그인 실패로 관리자 계정이 일시 잠겼습니다. 잠시 후 다시 시도해 주세요.';
    }
    return login.error.message;
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">A-idol CMS</CardTitle>
          <CardDescription>관리자 계정으로 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@a-idol.dev"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>
            {serverMessage && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{serverMessage}</p>
            )}
            <Button type="submit" disabled={isSubmitting || login.isPending}>
              {login.isPending ? '로그인 중…' : '로그인'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
