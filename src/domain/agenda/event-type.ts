export type EventKind = 'rehearsal' | 'service' | 'class' | 'special';

export type EventType = {
  id: string;
  organizationId: string;
  name: string;
  kind: EventKind;
  sortOrder: number;
  color: string | null;
};

export type EventTypeInput = {
  name: string;
  kind: EventKind;
  sortOrder?: number;
  color?: string | null;
};
