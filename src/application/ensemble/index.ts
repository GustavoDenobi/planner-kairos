import type { GroupRepository } from '@/application/ports/group-repository';
import type { GroupInput, ListGroupsOptions } from '@/application/ports/group-repository';

import { listGroups } from './list-groups';
import {
  archiveGroup,
  createGroup,
  deleteGroup,
  getGroup,
  restoreGroup,
  updateGroup,
} from './group-use-cases';

export type EnsembleDeps = {
  groupRepo: GroupRepository;
};

export function createEnsembleUseCases(deps: EnsembleDeps) {
  return {
    listGroups: (organizationId: string, options?: ListGroupsOptions) =>
      listGroups(deps.groupRepo, organizationId, options),
    getGroup: (organizationId: string, groupId: string) =>
      getGroup(deps.groupRepo, organizationId, groupId),
    createGroup: (organizationId: string, input: GroupInput) =>
      createGroup(deps.groupRepo, organizationId, input),
    updateGroup: (organizationId: string, groupId: string, input: GroupInput) =>
      updateGroup(deps.groupRepo, organizationId, groupId, input),
    archiveGroup: (organizationId: string, groupId: string) =>
      archiveGroup(deps.groupRepo, organizationId, groupId),
    restoreGroup: (organizationId: string, groupId: string) =>
      restoreGroup(deps.groupRepo, organizationId, groupId),
    deleteGroup: (organizationId: string, groupId: string) =>
      deleteGroup(deps.groupRepo, organizationId, groupId),
  };
}

export type EnsembleUseCases = ReturnType<typeof createEnsembleUseCases>;
