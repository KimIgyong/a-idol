import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AdminRole, AdminUserDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';

const ROLE_OPTIONS: AdminRole[] = ['admin', 'operator', 'viewer'];
const QK = ['admin', 'operators'] as const;

interface Props {
  target: AdminUserDto;
  onClose: () => void;
  onToast: (message: string) => void;
}

/**
 * FR-102 — 역할 변경 모달.
 *
 * 본인 행은 부모(OperatorsPage) 의 ⋮ 메뉴에서 비활성 — 본 모달은 그래도
 * 서버 fail-safe 메시지(ADMIN_SELF_MODIFICATION_FORBIDDEN) 처리한다.
 */
export function RoleChangeDialog({ target, onClose, onToast }: Props) {
  const { t } = useTranslation('operator');
  const queryClient = useQueryClient();

  const [role, setRole] = useState<AdminRole>(target.role);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => adminApi.updateOperatorRole(target.id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QK });
      onToast(t('toast.role_updated'));
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'ADMIN_LAST_ADMIN_DEMOTION':
            setError(t('errors.last_admin_demotion'));
            return;
          case 'ADMIN_LIMIT_EXCEEDED':
            setError(t('errors.limit_exceeded'));
            return;
          case 'ADMIN_SELF_MODIFICATION_FORBIDDEN':
            setError(t('errors.self_modification'));
            return;
          default:
            setError(err.message || t('errors.generic'));
        }
      } else {
        setError(t('errors.generic'));
      }
    },
  });

  const pending = mutation.isPending;
  const unchanged = role === target.role;

  return (
    <Modal
      open
      onClose={pending ? () => undefined : onClose}
      title={t('role_change_modal.title')}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={pending || unchanged}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {pending ? '...' : t('actions.save')}
          </Button>
        </div>
      }
    >
      <dl className="mb-3 space-y-2 text-sm">
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-ink-600">{t('field.target')}</dt>
          <dd className="text-ink-900">
            {target.email}
            <span className="ml-2 text-ink-500">({target.displayName})</span>
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-ink-600">{t('field.current_role')}</dt>
          <dd className="text-ink-900">{t(`role.${target.role}`)}</dd>
        </div>
      </dl>

      <div className="space-y-1">
        <Label htmlFor="role-select">{t('field.role')}</Label>
        <select
          id="role-select"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as AdminRole);
            setError(null);
          }}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 rounded border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-ink-700">
        ⚠ {t('role_change_modal.demotion_warning')}
      </p>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          ⚠ {error}
        </p>
      ) : null}
    </Modal>
  );
}
