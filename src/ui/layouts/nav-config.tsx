import type { OrganizationWithRole } from '@/application/ports';
import {
  IconCalendar,
  IconMusic,
  IconPlay,
  IconTrumpet,
  IconUser,
  IconUsers,
} from '@/ui/components/icons';
import type { ReactNode } from 'react';

export type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
};

export const baseNavItems: NavItem[] = [
  { to: 'agenda', label: 'Agenda', icon: <IconCalendar className="h-5 w-5 shrink-0" /> },
  { to: 'repertorio', label: 'Repertório', icon: <IconMusic className="h-5 w-5 shrink-0" /> },
  { to: 'leitura', label: 'Playlist', icon: <IconPlay className="h-5 w-5 shrink-0" /> },
];

export const adminNavItems: NavItem[] = [
  {
    to: 'musicos',
    label: 'Músicos',
    icon: <IconUser className="h-5 w-5 shrink-0" />,
    adminOnly: true,
  },
  {
    to: 'grupos',
    label: 'Grupos',
    icon: <IconUsers className="h-5 w-5 shrink-0" />,
    adminOnly: true,
  },
  {
    to: 'partes',
    label: 'Partes',
    icon: <IconTrumpet className="h-5 w-5 shrink-0" />,
    adminOnly: true,
  },
];

export function isOrgAdminAccess(
  org: OrganizationWithRole | undefined,
  isPlatformAdmin = false,
): boolean {
  if (isPlatformAdmin) {
    return true;
  }

  return org?.accessRole === 'admin' || org?.accessRole === 'owner';
}

export function getNavItemsForOrg(
  org: OrganizationWithRole | undefined,
  isPlatformAdmin = false,
): NavItem[] {
  return isOrgAdminAccess(org, isPlatformAdmin)
    ? [...baseNavItems, ...adminNavItems]
    : baseNavItems;
}
