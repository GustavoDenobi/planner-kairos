import type { ReactNode } from 'react';
import { BackButton } from '@/ui/components/BackButton';
import { IconArrowDown } from '@/ui/components/icons';

type ReaderLayoutProps = {
  title: string;
  backTo: string;
  downloadUrl?: string | null;
  downloadName?: string;
  children: ReactNode;
};

export function ReaderLayout({
  title,
  backTo,
  downloadUrl,
  downloadName,
  children,
}: ReaderLayoutProps) {
  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <BackButton fallbackTo={backTo} />
        <h1 className="min-w-0 flex-1 truncate text-base font-medium text-text sm:text-lg">
          {title}
        </h1>
        {downloadUrl && (
          <a
            href={downloadUrl}
            download={downloadName}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-text hover:bg-bg"
          >
            <IconArrowDown className="h-4 w-4" />
            <span className="hidden sm:inline">Baixar</span>
          </a>
        )}
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
