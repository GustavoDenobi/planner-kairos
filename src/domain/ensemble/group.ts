export type GroupKind = 'ensemble' | 'choir' | 'class' | 'other';

export type Group = {
  id: string;
  organizationId: string;
  name: string;
  kind: GroupKind;
  notes: string | null;
  archivedAt: Date | null;
};

export type GroupListItem = Group & {
  memberCount: number;
};
