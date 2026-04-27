import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorLine } from '@/components/ui/error-line';

const QK = ['admin', 'operators'] as const;

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  operator: 'Operator',
  viewer: 'Viewer',
};

const STATUS_LABEL: Record<string, string> = {
  active: '활성',
  suspended: '정지',
};

/**
 * 운영자 관리 — read-only 1차 슬라이스 (RPT-260426-B §5).
 *
 * 추가: 잠긴 계정 즉시 해제 (T-082 후속, NIST §5.2.2 lockout 우회).
 *
 * 다음 슬라이스에서 추가 예정:
 *  - 신규 운영자 추가 모달 (싱가폴 법인 운영팀 추가용)
 *  - role 변경 (admin↔operator↔viewer)
 *  - suspend / unsuspend
 *  - 비밀번호 reset
 *
 * 모든 write actions는 backend `@Roles('admin')` 게이트로 막힘. 이 페이지
 * 자체도 router에서 admin role에게만 노출.
 */
export function OperatorsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: QK,
    queryFn: () => adminApi.listOperators(),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">운영자 관리</h1>
          <p className="mt-1 text-sm text-ink-600">
            CMS admin / operator / viewer 계정. 신규 추가·역할 변경·정지는 다음 sprint.
          </p>
        </div>
      </div>

      <UnlockAccountPanel />

      {error ? (
        <Card className="mb-4 border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <ErrorLine error={error} prefix="불러오기 실패" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">전체 ({data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-600">
                <th className="py-2 text-left">이메일</th>
                <th className="py-2 text-left">표시 이름</th>
                <th className="py-2 text-left">역할</th>
                <th className="py-2 text-left">상태</th>
                <th className="py-2 text-right">최근 로그인</th>
                <th className="py-2 text-right">생성일</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-600">
                    로딩 중…
                  </td>
                </tr>
              ) : data && data.length > 0 ? (
                data.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-3 font-medium text-ink-900">{a.email}</td>
                    <td className="py-3 text-ink-700">{a.displayName}</td>
                    <td className="py-3">
                      <span
                        className={
                          a.role === 'admin'
                            ? 'inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700'
                            : 'inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-ink-700'
                        }
                      >
                        {ROLE_LABEL[a.role] ?? a.role}
                      </span>
                    </td>
                    <td className="py-3">
                      <span
                        className={
                          a.status === 'active'
                            ? 'inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-700'
                            : 'inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-700'
                        }
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-xs text-ink-600">
                      {a.lastLoginAt
                        ? new Date(a.lastLoginAt).toLocaleString()
                        : <span className="text-ink-500">—</span>}
                    </td>
                    <td className="py-3 text-right text-xs text-ink-600">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-600">
                    등록된 운영자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 잠긴 계정 즉시 해제 panel — admin role 전용.
 * 사용자/운영자 누구든 email 만 알면 unlock 가능. audit log는 backend 자동 기록.
 */
function UnlockAccountPanel() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (e: string) => adminApi.unlockAccount(e),
    onSuccess: () => {
      setSuccess(`${email} 계정의 로그인 잠금이 해제되었습니다.`);
      setEmail('');
      setTimeout(() => setSuccess(null), 4000);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSuccess(null);
    mutation.mutate(email.trim());
  };

  const errorMsg =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? '잠금 해제 중 오류가 발생했습니다.'
        : null;

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50/30">
      <CardHeader>
        <CardTitle className="text-base">계정 잠금 해제 (T-082)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-ink-700">
          NIST §5.2.2 — 10회 로그인 실패로 잠긴 계정을 즉시 해제합니다 (15분
          대기 우회). 사용자/운영자 모두 이메일로 가능. 모든 호출은 audit log
          에 기록됩니다.
        </p>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="unlock-email">이메일</Label>
            <Input
              id="unlock-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="locked-user@example.com"
              required
            />
          </div>
          <Button type="submit" disabled={mutation.isPending || !email.trim()}>
            {mutation.isPending ? '해제 중…' : '잠금 해제'}
          </Button>
        </form>
        {errorMsg ? (
          <div className="mt-2 text-sm text-red-700" role="alert">⚠ {errorMsg}</div>
        ) : null}
        {success ? (
          <div className="mt-2 text-sm text-green-700" role="status">✅ {success}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
