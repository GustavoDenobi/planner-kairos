import { useBodyScrollLock } from '@/ui/components/useBodyScrollLock';

type PwaUpdateModalProps = {
  updating: boolean;
  onUpdate: () => void;
};

export function PwaUpdateModal({ updating, onUpdate }: PwaUpdateModalProps) {
  useBodyScrollLock(true);

  return (
    <div
      data-modal-overlay
      className="fixed inset-x-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60"
      style={{
        paddingTop: 'max(1rem, var(--safe-area-top))',
        paddingRight: 'max(1rem, var(--safe-area-right))',
        paddingBottom: 'max(1rem, var(--safe-area-bottom))',
        paddingLeft: 'max(1rem, var(--safe-area-left))',
        top: 'var(--vv-offset-top)',
        height: 'var(--app-vh)',
      }}
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
          Uma atualização da plataforma está disponível. Atualize agora para continuar com a versão mais
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
