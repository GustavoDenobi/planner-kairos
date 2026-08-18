import type { ReactNode } from 'react';

import { BackButton } from '@/ui/components/BackButton';

import { IconArrowDown } from '@/ui/components/icons';



type ReaderLayoutProps = {

  title?: string;

  subtitle?: string;

  backTo: string;

  downloadUrl?: string | null;

  downloadName?: string;

  centerContent?: ReactNode;

  children: ReactNode;

};



export function ReaderLayout({

  title,

  subtitle,

  backTo,

  downloadUrl,

  downloadName,

  centerContent,

  children,

}: ReaderLayoutProps) {

  return (

    <div className="flex h-dvh flex-col bg-bg">

      <header className="relative flex shrink-0 items-center border-b border-border bg-surface px-4 py-3">

        <BackButton fallbackTo={backTo} variant="close" />

        <div className="pointer-events-none absolute inset-x-0 flex justify-center px-14 sm:px-20">

          <div className="pointer-events-auto min-w-0 max-w-full text-center">

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

        </div>

        <div className="ml-auto shrink-0">

          {downloadUrl ? (

            <a

              href={downloadUrl}

              download={downloadName}

              target="_blank"

              rel="noopener noreferrer"

              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-text hover:bg-bg"

            >

              <IconArrowDown className="h-4 w-4" />

            </a>

          ) : null}

        </div>

      </header>

      <main className="flex min-h-0 flex-1 flex-col">{children}</main>

    </div>

  );

}

