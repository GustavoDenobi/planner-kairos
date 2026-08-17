import type { OrganizationWithRole } from '@/application/ports';
import {
  IconCalendar,
  IconLayers,
  IconMic,
  IconMusic,
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
];

export const adminNavItems: NavItem[] = [
  {
    to: 'musicos',
    label: 'Músicos',
    icon: <IconUsers className="h-5 w-5 shrink-0" />,
    adminOnly: true,
  },
  {
    to: 'grupos',
    label: 'Grupos',
    icon: <IconLayers className="h-5 w-5 shrink-0" />,
    adminOnly: true,
  },
  {
    to: 'partes',
    label: 'Partes',
    icon: <IconMic className="h-5 w-5 shrink-0" />,
    adminOnly: true,
  },
];

export function getNavItemsForOrg(org: OrganizationWithRole | undefined): NavItem[] {
  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';
  return isAdmin ? [...baseNavItems, ...adminNavItems] : baseNavItems;
}
