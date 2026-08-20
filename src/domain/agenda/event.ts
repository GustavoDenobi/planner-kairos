import type { GroupKind } from '@/domain/ensemble';
import type { EventKind } from './event-type';

export type EventAudienceGroup = {
  id: string;
  name: string;
  kind: GroupKind;
};

export type EventAudienceMusician = {
  id: string;
  fullName: string;
  userId: string | null;
};

export type Event = {
  id: string;
  organizationId: string;
  typeId: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
  createdBy: string | null;
};

export type EventInput = {
  typeId: string;
  title?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  groupIds?: string[];
  musicianIds?: string[];
};

export type EventListItem = {
  id: string;
  typeId: string;
  typeName: string;
  typeKind: EventKind;
  typeColor: string | null;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  programCount: number;
  createdBy: string | null;
  groups: EventAudienceGroup[];
  musicians: EventAudienceMusician[];
};
