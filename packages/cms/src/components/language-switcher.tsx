import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { LOCALE_LABEL, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/i18n';
import { cn } from '@/lib/utils';

/**
 * 사이드바 하단에 두는 컴팩트 셀렉트형 언어 전환기.
 * 4 locale (ko/en/vi/zh-CN) 만 노출.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation('common');
  const current = (SUPPORTED_LOCALES as readonly string[]).includes(i18n.resolvedLanguage ?? '')
    ? (i18n.resolvedLanguage as SupportedLocale)
    : 'ko';

  return (
    <label className={cn('flex items-center gap-2 text-xs text-slate-500', className)}>
      <Globe className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{t('language.label')}</span>
      <select
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-ink-700 focus:border-brand-500 focus:outline-none"
        aria-label={t('language.label')}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABEL[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
