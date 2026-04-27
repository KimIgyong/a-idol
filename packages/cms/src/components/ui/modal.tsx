import * as React from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * Minimal modal — no focus trap, no animations. Good enough for MVP
 * admin dialogs; replace with Radix Dialog when richer UX is needed.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-white shadow-xl',
          sizeMap[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 p-5">
          <h2 id="modal-title" className="text-lg font-semibold text-ink-900">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-ink-600">{description}</p> : null}
        </div>
        <div className="p-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4 rounded-b-xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
