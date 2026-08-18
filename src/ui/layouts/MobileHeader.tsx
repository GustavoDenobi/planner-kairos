import { OrgPickerDropdown } from '@/ui/components/OrgPickerDropdown';
import { UserMenuDropdown } from '@/ui/components/UserMenuDropdown';
import { spacing } from '@/ui/theme/tokens';

type MobileHeaderProps = {
  orgSlug: string;
};

export function MobileHeader({ orgSlug }: MobileHeaderProps) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 md:hidden"
      style={{ height: spacing.headerHeight }}
    >
      <div className="min-w-0 flex-1">
        <OrgPickerDropdown orgSlug={orgSlug} />
      </div>
      <UserMenuDropdown />
    </header>
  );
}
