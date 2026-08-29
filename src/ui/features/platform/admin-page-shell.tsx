import type { ReactNode } from 'react';
import { orgPageContentClass } from '@/ui/layouts/OrgListPageLayout';

type AdminPageShellProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
};

export function AdminPageShell({ title, subtitle, action, toolbar, children }: AdminPageShellProps) {
  return (
    <div className={orgPageContentClass}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {toolbar ? <div className="mb-4">{toolbar}</div> : null}
      {children}
    </div>
  );
}

export const adminListClass = 'flex flex-col gap-2';

export const adminListItemClass =
  'flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg';

export const adminEmptyStateClass = 'text-sm text-muted';

export const adminFieldClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary';

export const adminSelectClass =
  'rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary';

export const adminPrimaryButtonClass =
  'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60';

export const adminSecondaryButtonClass =
  'rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-bg hover:text-text disabled:opacity-60';

export const adminSectionClass = 'rounded-xl border border-border bg-surface p-4';
