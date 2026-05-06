import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Plus } from 'lucide-react';
import type { AdminUserDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorLine } from '@/components/ui/error-line';
import { useAuthStore } from '@/features/auth/auth-store';
import { OperatorFormDialog } from './operator-form-dialog';
import { PasswordShownDialog } from './password-shown-dialog';
import { RoleChangeDialog } from './role-change-dialog';

const QK = ['admin', 'operators'] as const;

const STATUS_LABEL: Record<string, string> = {
  active: '활성',
  suspended: '정지',
};

/**
 * 운영자 관리 — admin / operator / viewer 계정 (FR-102, RPT-260507).
 *
 *  - 목록 조회 + 잠금 해제 (T-082)
 *  - 신규 등록 (admin only) — OperatorFormDialog → PasswordShownDialog
 *  - 역할 변경 (admin only) — RoleChangeDialog. 본인 행은 ⋮ 비활성
 *
 * Suspend / unsuspend / 비밀번호 reset 는 후속 슬라이스.
 *
 * 모든 write 는 backend `@Roles('admin')` 게이트로 막힘. 라우터에서도
 * `/operators` 를 admin 에게만 노출 (router.tsx).
 */
export function OperatorsPage() {
  const { t } = useTranslation('operator');
  const session = useAuthStore((s) => s.session);
  const isAdmin = session?.user.role === 'admin';
  const myId = session?.user.id;

  const { data, isLoading, error } = useQuery({
    queryKey: QK,
    queryFn: () => adminApi.listOperators(),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [shownPassword, setShownPassword] = useState<{ email: string; password: string } | null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<AdminUserDto | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-ink-600">{t('subtitle')}</p>
        </div>
        {isAdmin ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('actions.create')}
          </Button>
        ) : null}
      </div>

      {toast ? (
        <div
          className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
          role="status"
        >
          ✅ {toast}
        </div>
      ) : null}

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
                <th className="py-2 text-left">{t('field.email')}</th>
                <th className="py-2 text-left">{t('field.display_name')}</th>
                <th className="py-2 text-left">{t('field.role')}</th>
                <th className="py-2 text-left">상태</th>
                <th className="py-2 text-right">최근 로그인</th>
                <th className="py-2 text-right">생성일</th>
                <th className="w-10 py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-600">
                    로딩 중…
                  </td>
                </tr>
              ) : data && data.length > 0 ? (
                data.map((a) => {
                  const isSelf = a.id === myId;
                  return (
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
                          {t(`role.${a.role}`)}
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
                        {a.lastLoginAt ? (
                          new Date(a.lastLoginAt).toLocaleString()
                        ) : (
                          <span className="text-ink-500">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-xs text-ink-600">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        {isAdmin ? (
                          <RowMenu
                            disabled={isSelf}
                            disabledTooltip={t('menu.self_disabled_tooltip')}
                            onChangeRole={() => setRoleChangeTarget(a)}
                            label={t('actions.role_change')}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-600">
                    등록된 운영자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {createOpen ? (
        <OperatorFormDialog
          onClose={() => setCreateOpen(false)}
          onSuccess={(created) => {
            setShownPassword(created);
            showToast(t('toast.created'));
          }}
        />
      ) : null}

      {shownPassword ? (
        <PasswordShownDialog
          email={shownPassword.email}
          password={shownPassword.password}
          onClose={() => setShownPassword(null)}
        />
      ) : null}

      {roleChangeTarget ? (
        <RoleChangeDialog
          target={roleChangeTarget}
          onClose={() => setRoleChangeTarget(null)}
          onToast={showToast}
        />
      ) : null}
    </div>
  );
}

function RowMenu({
  disabled,
  disabledTooltip,
  onChangeRole,
  label,
}: {
  disabled: boolean;
  disabledTooltip: string;
  onChangeRole: () => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        title={disabled ? disabledTooltip : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        className={
          disabled
            ? 'inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded text-slate-300'
            : 'inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100'
        }
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && !disabled ? (
        <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
              onChangeRole();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-slate-50"
          >
            {label}
          </button>
        </div>
      ) : null}
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
