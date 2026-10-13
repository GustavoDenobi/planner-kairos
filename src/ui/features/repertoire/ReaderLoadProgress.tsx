type ReaderLoadProgressProps = {
  /** Fração de 0 a 1. */
  progress: number;
  label?: string;
  onCancel?: () => void;
  cancelLabel?: string;
};

export function ReaderLoadProgress({
  progress,
  label = 'Carregando partitura…',
  onCancel,
  cancelLabel = 'Cancelar',
}: ReaderLoadProgressProps) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <p className="mb-6 text-sm text-muted">{label}</p>
      <div
        className="relative h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-primary/20"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
          style={{ width: `${Math.max(percent > 0 ? 4 : 0, percent)}%` }}
        />
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-8 rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text transition-colors hover:bg-bg"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
}
