import type { EventKind } from './event-type';

export type Event = {
  id: string;
  organizationId: string;
  typeId: string;
  title: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
};

export type EventInput = {
  typeId: string;
  title?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  notes?: string | null;
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
};
