import type { ReactNode, Ref } from 'react';

export const orgPageContentClass = 'w-full max-w-6xl';

export const orgListPageHeightClass =
  'h-[calc(var(--app-vh)-var(--app-header-offset)-var(--app-bottom-nav-offset)-2rem)] md:h-[calc(var(--app-vh)-6.5rem)]';

type OrgListPageLayoutProps = {
  header: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  scrollRef?: Ref<HTMLDivElement>;
};

export function OrgListPageLayout({
  header,
  toolbar,
  children,
  scrollRef,
}: OrgListPageLayoutProps) {
  return (
    <div
      className={`flex flex-col ${orgPageContentClass} ${orgListPageHeightClass}`}
    >
      <div className="shrink-0 space-y-4 pb-6">
        {header}
        {toolbar}
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
    </div>
  );
}
