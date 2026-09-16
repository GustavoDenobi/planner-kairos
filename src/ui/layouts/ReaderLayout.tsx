import type { ReactNode } from 'react';
import { BackButton } from '@/ui/components/BackButton';
import { useLoadingBarPlacement } from '@/ui/app/loading-bar/useLoadingBar';

type ReaderLayoutProps = {
  title?: string;
  subtitle?: string;
  backTo: string;
  onTitleClick?: () => void;
  centerContent?: ReactNode;
  headerActions?: ReactNode;
  offlineBanner?: ReactNode;
  children: ReactNode;
};

export function ReaderLayout({
  title,
  subtitle,
  backTo,
  onTitleClick,
  centerContent,
  headerActions,
  offlineBanner,
  children,
}: ReaderLayoutProps) {
  useLoadingBarPlacement('belowReaderHeader');

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
                onTitleClick ? (
                  <button
                    type="button"
                    onClick={onTitleClick}
                    className="max-w-full truncate text-base font-medium text-text underline-offset-2 hover:underline sm:text-lg"
                  >
                    {title}
                  </button>
                ) : (
                  <h1 className="truncate text-base font-medium text-text sm:text-lg">{title}</h1>
                )
              )}
              {subtitle && (
                <p className="truncate text-xs text-muted sm:text-sm">{subtitle}</p>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerActions}
        </div>
      </header>
      {offlineBanner}
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
