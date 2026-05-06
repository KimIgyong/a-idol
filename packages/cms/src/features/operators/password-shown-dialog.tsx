import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

interface Props {
  email: string;
  password: string;
  onClose: () => void;
}

/**
 * FR-102 — 등록 직후 평문 비밀번호 1회 표시 다이얼로그.
 *
 * 비밀번호는 부모 컴포넌트가 보유한 state — 본 모달이 close 될 때 부모가
 * 즉시 null 처리. 서버에는 평문 미저장.
 */
export function PasswordShownDialog({ email, password, onClose }: Props) {
  const { t } = useTranslation('operator');
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard 권한 없음 — 사용자가 직접 복사
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`✓ ${t('password_shown.title')}`}
      size="md"
      footer={
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            {t('actions.confirm')}
          </Button>
        </div>
      }
    >
      <dl className="space-y-3 text-sm">
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-ink-600">{t('field.email')}</dt>
          <dd className="font-mono text-ink-900">{email}</dd>
        </div>
        <div className="flex items-center gap-3">
          <dt className="w-20 shrink-0 text-ink-600">{t('field.password')}</dt>
          <dd className="flex flex-1 items-center gap-2">
            <code className="flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-ink-900">
              {shown ? password : '•'.repeat(password.length || 8)}
            </code>
            <button
              type="button"
              onClick={() => setShown((s) => !s)}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100"
              title={shown ? t('password_shown.hide') : t('password_shown.show')}
            >
              {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100"
              title={copied ? t('password_shown.copied') : t('password_shown.copy')}
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </dd>
        </div>
      </dl>
      <p className="mt-4 rounded border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-ink-700">
        ⚠ {t('password_shown.warning')}
      </p>
    </Modal>
  );
}
