import { IconDownload, IconX } from '@/ui/components/icons';
import {
  getPwaInstallBannerHint,
  PWA_INSTALL_BANNER_LABEL,
} from '@/ui/features/pwa/pwa-install-labels';
import { usePwaInstallContext } from '@/ui/features/pwa/PwaInstallContext';

export function PwaInstallMobileBanner() {
  const { kind, visible, openModal, dismissSession } = usePwaInstallContext();
  const hint = getPwaInstallBannerHint(kind);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="pwa-install-banner-enter fixed inset-x-0 z-[15] flex h-12 items-center border-t border-border bg-surface md:hidden"
      style={{
        bottom: 'var(--app-bottom-nav-offset)',
        paddingLeft: 'max(0.5rem, var(--safe-area-left))',
        paddingRight: 'max(0.5rem, var(--safe-area-right))',
      }}
      role="region"
      aria-label={PWA_INSTALL_BANNER_LABEL}
    >
      <button
        type="button"
        onClick={openModal}
        className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
      >
        <IconDownload className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-text">{PWA_INSTALL_BANNER_LABEL}</span>
          <span className="block truncate text-xs text-muted">{hint}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={dismissSession}
        className="shrink-0 rounded-lg p-2 text-muted hover:bg-bg hover:text-text"
        aria-label="Fechar"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}
