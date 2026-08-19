type PwaUpdateModalProps = {
  updating: boolean;
  onUpdate: () => void;
};

export function PwaUpdateModal({ updating, onUpdate }: PwaUpdateModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-description"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg">
        <h2 id="pwa-update-title" className="text-lg font-semibold text-text">
          Nova versão disponível
        </h2>
        <p id="pwa-update-description" className="mt-2 text-sm text-muted">
          Uma atualização do app foi instalada. Atualize agora para continuar com a versão mais
          recente.
        </p>
        <button
          type="button"
          onClick={onUpdate}
          disabled={updating}
          className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {updating ? 'Atualizando…' : 'Atualizar agora'}
        </button>
      </div>
    </div>
  );
}
