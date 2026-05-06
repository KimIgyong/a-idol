import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { AdminRole } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';

const ROLE_OPTIONS: AdminRole[] = ['admin', 'operator', 'viewer'];
const QK = ['admin', 'operators'] as const;

interface Props {
  onClose: () => void;
  /** 등록 성공 시 평문 비번을 부모로 전달 — 부모가 PasswordShownDialog 띄움. */
  onSuccess: (created: { email: string; password: string }) => void;
}

/**
 * FR-102 — 신규 어드민 등록 모달.
 *
 * 평문 비번은 서버 응답에 미포함. submit 시 입력값을 부모로 그대로 전달하고
 * 모달은 close. 부모가 받은 평문은 PasswordShownDialog 가 1회 표시 후 메모리
 * null 처리.
 */
export function OperatorFormDialog({ onClose, onSuccess }: Props) {
  const { t } = useTranslation('operator');
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('operator');

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);

  const clearErrors = () => {
    setEmailError(null);
    setPasswordError(null);
    setRoleError(null);
    setGenericError(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createOperator({
        email: email.trim(),
        display_name: displayName.trim(),
        password,
        role,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QK });
      onSuccess({ email: email.trim(), password });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'ADMIN_EMAIL_DUPLICATE':
            setEmailError(t('errors.email_duplicate'));
            return;
          case 'ADMIN_LIMIT_EXCEEDED':
            setRoleError(t('errors.limit_exceeded'));
            return;
          default:
            // class-validator 400 — 보통 password 정책 위반
            if (err.status === 400) {
              setPasswordError(t('errors.weak_password'));
              return;
            }
            setGenericError(err.message || t('errors.generic'));
        }
      } else {
        setGenericError(t('errors.generic'));
      }
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!email.trim() || !displayName.trim() || !password) return;
    mutation.mutate();
  };

  const pending = mutation.isPending;
  const canSubmit = email.trim() && displayName.trim() && password && !pending;

  return (
    <Modal
      open
      onClose={pending ? () => undefined : onClose}
      title={t('create_modal.title')}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" form="operator-create-form" disabled={!canSubmit}>
            {pending ? '...' : t('actions.register')}
          </Button>
        </div>
      }
    >
      <form id="operator-create-form" onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="op-email">{t('field.email')}</Label>
          <Input
            id="op-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            required
          />
          {emailError ? (
            <p className="text-xs text-red-600" role="alert">
              ⚠ {emailError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="op-name">{t('field.display_name')}</Label>
          <Input
            id="op-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="op-pw">{t('field.password')}</Label>
          <Input
            id="op-pw"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(null);
            }}
            minLength={8}
            required
          />
          <p className="text-xs text-ink-500">{t('create_modal.password_hint')}</p>
          {passwordError ? (
            <p className="text-xs text-red-600" role="alert">
              ⚠ {passwordError}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label>{t('field.role')}</Label>
          <div className="space-y-1">
            {ROLE_OPTIONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="op-role"
                  value={r}
                  checked={role === r}
                  onChange={() => {
                    setRole(r);
                    setRoleError(null);
                  }}
                />
                {t(`role.${r}`)}
              </label>
            ))}
          </div>
          {roleError ? (
            <p className="text-xs text-red-600" role="alert">
              ⚠ {roleError}
            </p>
          ) : null}
        </div>

        <p className="rounded border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-ink-700">
          ℹ {t('create_modal.handover_notice')}
        </p>

        {genericError ? (
          <p className="text-sm text-red-600" role="alert">
            ⚠ {genericError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
