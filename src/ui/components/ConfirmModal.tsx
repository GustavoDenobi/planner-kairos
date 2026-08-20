import type { ReactNode } from 'react';
import { useBodyScrollLock } from '@/ui/components/useBodyScrollLock';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  isConfirming?: boolean;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onClose,
  isConfirming = false,
}: ConfirmModalProps) {
  useBodyScrollLock(open);

  if (!open) {
    return null;
  }

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
        className="absolute inset-0 bg-black/50"
        aria-label="Fechar"
        onClick={onClose}
        disabled={isConfirming}
      />
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-text">
          {title}
        </h2>
        <div id="confirm-modal-message" className="mt-2 text-sm text-muted">
          {message}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isConfirming ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
