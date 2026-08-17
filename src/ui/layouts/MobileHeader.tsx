import { useOrg } from '@/ui/app/OrgProvider';
import { OrgAvatar } from '@/ui/components/OrgAvatar';
import { UserMenuDropdown } from '@/ui/components/UserMenuDropdown';
import { spacing } from '@/ui/theme/tokens';

type MobileHeaderProps = {
  orgSlug: string;
};

export function MobileHeader({ orgSlug }: MobileHeaderProps) {
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);

  return (
    <header
      className="fixed inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 md:hidden"
      style={{ height: spacing.headerHeight }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {org ? (
          <>
            <OrgAvatar organization={org} size="sm" variant="square" />
            <p className="truncate text-base font-semibold text-text">{org.name}</p>
          </>
        ) : (
          <p className="text-base font-semibold text-text">{orgSlug}</p>
        )}
      </div>
      <UserMenuDropdown />
    </header>
  );
}
