import { Modal } from '@/ui/components/Modal';
import { getPwaInstallCopy } from '@/ui/features/pwa/pwa-install-labels';
import { usePwaInstallContext } from '@/ui/features/pwa/PwaInstallContext';

export function PwaInstallModal() {
  const { kind, modalOpen, closeModal, dismissSession, promptNativeInstall } = usePwaInstallContext();
  const copy = getPwaInstallCopy(kind);

  if (!copy) {
    return null;
  }

  async function handlePrimary() {
    if (kind === 'native' || kind === 'samsung-internet') {
      await promptNativeInstall();
      return;
    }
    closeModal();
  }

  return (
    <Modal open={modalOpen} onClose={closeModal} title={copy.title}>
      <p className="text-sm text-muted">{copy.description}</p>
      {copy.steps.length > 0 ? (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-text">
          {copy.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={() => void handlePrimary()}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 sm:w-auto"
        >
          {copy.primaryCta}
        </button>
        <button
          type="button"
          onClick={dismissSession}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-muted hover:bg-bg hover:text-text sm:w-auto"
        >
          {copy.secondaryCta}
        </button>
      </div>
    </Modal>
  );
}
