import { useEffect } from 'react';

type ToastProps = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

export function Toast({ message, onDismiss, durationMs = 4000 }: ToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(var(--app-bottom-nav-offset)+1rem)] left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text shadow-lg md:bottom-6"
    >
      {message}
    </div>
  );
}
