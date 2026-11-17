import type { ReactNode, Ref } from 'react';

export const orgPageContentClass = 'w-full max-w-6xl';

export const orgListPageHeightClass = 'min-h-0 flex-1';

/** ~1/3 da viewport — respiro após o último item em áreas com scroll. */
export const scrollContentEndPaddingClass = 'scroll-content-end-padding';

export const orgListScrollAreaClass = `min-h-0 flex-1 overflow-y-auto overscroll-contain ${scrollContentEndPaddingClass}`;

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
        className={orgListScrollAreaClass}
      >
        {children}
      </div>
    </div>
  );
}
