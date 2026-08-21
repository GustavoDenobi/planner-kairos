import type { Group, GroupFileAccessSettings, GroupKind, GroupListItem } from '@/domain/ensemble';

export type GroupInput = {
  name: string;
  kind: GroupKind;
  notes?: string | null;
};

export type GroupFileAccessInput = GroupFileAccessSettings;

export type ListGroupsOptions = {
  includeArchived?: boolean;
};

export type GroupRepository = {
  listForOrg(organizationId: string, options?: ListGroupsOptions): Promise<GroupListItem[]>;
  getById(organizationId: string, groupId: string): Promise<Group | null>;
  create(organizationId: string, input: GroupInput): Promise<Group>;
  update(organizationId: string, groupId: string, input: GroupInput): Promise<Group>;
  updateFileAccessSettings(
    organizationId: string,
    groupId: string,
    input: GroupFileAccessInput,
  ): Promise<Group>;
  archive(organizationId: string, groupId: string): Promise<Group>;
  restore(organizationId: string, groupId: string): Promise<Group>;
  delete(organizationId: string, groupId: string): Promise<void>;
  reorderGroups(organizationId: string, orderedGroupIds: string[]): Promise<void>;
};
