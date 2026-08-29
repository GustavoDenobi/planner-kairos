import type { OrganizationWithRole } from '@/application/ports';
import { useOrg } from '@/ui/app/OrgProvider';

export function useIsOrgAdmin(org: OrganizationWithRole | undefined | null): boolean {
  const { isPlatformAdmin } = useOrg();

  if (isPlatformAdmin) {
    return true;
  }

  return org?.accessRole === 'admin' || org?.accessRole === 'owner';
}
