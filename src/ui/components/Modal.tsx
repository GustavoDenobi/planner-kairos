import type { ReactNode } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'md' | 'lg';
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) {
    return null;
  }

  const maxWidthClass = size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidthClass} rounded-xl border border-border bg-surface p-6 shadow-lg`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-bg hover:text-text"
          >
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
