import type { ReactNode } from 'react';
import { useBodyScrollLock } from '@/ui/components/useBodyScrollLock';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'md' | 'lg';
  allowBackdropInteraction?: boolean;
};

const modalPanelMaxHeightStyle = {
  maxHeight:
    'calc(var(--app-vh) - max(1rem, var(--safe-area-top)) - max(1rem, var(--safe-area-bottom)))',
} as const;

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  allowBackdropInteraction = false,
}: ModalProps) {
  useBodyScrollLock(open);

  if (!open) {
    return null;
  }

  const maxWidthClass = size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div
      data-modal-overlay
      className="fixed inset-x-0 z-50 flex items-center justify-center overflow-y-auto"
      style={{
        paddingTop: 'max(1rem, var(--safe-area-top))',
        paddingRight: 'max(1rem, var(--safe-area-right))',
        paddingBottom: 'max(1rem, var(--safe-area-bottom))',
        paddingLeft: 'max(1rem, var(--safe-area-left))',
        top: 'var(--vv-offset-top)',
        height: 'var(--app-vh)',
      }}
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/50 ${allowBackdropInteraction ? 'pointer-events-none' : ''}`}
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className={`relative flex w-full flex-col overflow-hidden ${maxWidthClass} rounded-xl border border-border bg-surface p-6 shadow-lg`}
        style={modalPanelMaxHeightStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-bg hover:text-text"
          >
            Fechar
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-y-contain">{children}</div>
      </div>
    </div>
  );
}
