import type { ReactNode } from 'react';
import { BackButton } from '@/ui/components/BackButton';
import { IconArrowDown } from '@/ui/components/icons';
import { useLoadingBarPlacement } from '@/ui/app/loading-bar/useLoadingBar';
import { downloadFromUrl } from '@/ui/utils/download-url';

type ReaderLayoutProps = {
  title?: string;
  subtitle?: string;
  backTo: string;
  downloadUrl?: string | null;
  downloadName?: string;
  centerContent?: ReactNode;
  headerActions?: ReactNode;
  offlineBanner?: ReactNode;
  children: ReactNode;
};

export function ReaderLayout({
  title,
  subtitle,
  backTo,
  downloadUrl,
  downloadName,
  centerContent,
  headerActions,
  offlineBanner,
  children,
}: ReaderLayoutProps) {
  useLoadingBarPlacement('belowReaderHeader');

  async function handleDownload() {
    if (!downloadUrl) {
      return;
    }
    try {
      await downloadFromUrl(downloadUrl, downloadName);
    } catch {
      /* Keep the reader open if the download cannot start. */
    }
  }

  return (
    <div className="flex h-[var(--app-vh)] flex-col bg-bg">
      <header
        className="flex shrink-0 items-center gap-2 border-b border-border bg-surface py-3"
        style={{
          minHeight: 'var(--app-header-offset)',
          paddingTop: 'max(0.75rem, var(--safe-area-top))',
          paddingLeft: 'max(1rem, var(--safe-area-left))',
          paddingRight: 'max(1rem, var(--safe-area-right))',
        }}
      >
        <div className="shrink-0">
          <BackButton fallbackTo={backTo} variant="close" />
        </div>
        <div className="min-w-0 flex-1 text-center">
          {centerContent ?? (
            <>
              {title && (
                <h1 className="truncate text-base font-medium text-text sm:text-lg">{title}</h1>
              )}
              {subtitle && (
                <p className="truncate text-xs text-muted sm:text-sm">{subtitle}</p>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          {downloadUrl ? (
            <button
              type="button"
              onClick={() => void handleDownload()}
              title="Baixar arquivo"
              aria-label="Baixar arquivo"
              className="inline-flex items-center gap-1 rounded-lg border border-border p-2 text-sm text-text transition-colors hover:bg-bg"
            >
              <IconArrowDown className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          ) : null}
        </div>
      </header>
      {offlineBanner}
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
