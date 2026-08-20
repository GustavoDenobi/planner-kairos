import { IconDownload } from '@/ui/components/icons';
import {
  getPwaInstallBannerHint,
  PWA_INSTALL_BANNER_LABEL,
} from '@/ui/features/pwa/pwa-install-labels';
import { usePwaInstallContext } from '@/ui/features/pwa/PwaInstallContext';

export function PwaInstallSidebarButton() {
  const { kind, visible, openModal } = usePwaInstallContext();

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={openModal}
      className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted transition-colors hover:bg-bg hover:text-text"
    >
      <IconDownload className="h-5 w-5 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate">{PWA_INSTALL_BANNER_LABEL}</span>
        {kind === 'samsung-internet' ? (
          <span className="block truncate text-xs font-normal">{getPwaInstallBannerHint(kind)}</span>
        ) : null}
      </span>
    </button>
  );
}
