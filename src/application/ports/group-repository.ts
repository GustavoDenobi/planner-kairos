import type { Group, GroupKind, GroupListItem } from '@/domain/ensemble';

export type GroupInput = {
  name: string;
  kind: GroupKind;
  notes?: string | null;
};

export type ListGroupsOptions = {
  includeArchived?: boolean;
};

export type GroupRepository = {
  listForOrg(organizationId: string, options?: ListGroupsOptions): Promise<GroupListItem[]>;
  getById(organizationId: string, groupId: string): Promise<Group | null>;
  create(organizationId: string, input: GroupInput): Promise<Group>;
  update(organizationId: string, groupId: string, input: GroupInput): Promise<Group>;
  archive(organizationId: string, groupId: string): Promise<Group>;
  restore(organizationId: string, groupId: string): Promise<Group>;
  delete(organizationId: string, groupId: string): Promise<void>;
};
