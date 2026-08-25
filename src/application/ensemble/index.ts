import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { GroupRepository, GroupInput, GroupFileAccessInput, ListGroupsOptions } from '@/application/ports/group-repository';
import type { ListMusiciansOptions, MusicianRepository } from '@/application/ports/musician-repository';
import type { PartRepository } from '@/application/ports/part-repository';
import type { SectionRepository } from '@/application/ports/section-repository';
import type { AssignmentInput, MusicianInput, PartDivisionInput, PartInput, SectionInput } from '@/domain/ensemble';

import {
  assignMusician,
  listAssignmentsForGroup,
  listAssignmentsForMusician,
  removeAssignment,
  updateAssignment,
} from './assignment-use-cases';
import { createGroup, deleteGroup, getGroup, updateGroup, archiveGroup, restoreGroup, updateGroupFileAccessSettings, reorderGroups } from './group-use-cases';
import { listGroups } from './list-groups';
import { createMusician, deleteMusician, getMusician, getMyMusician, listMusicians, mergeMusicians, updateMusician } from './musician-use-cases';
import {
  getPart,
  listParts,
  registerPart,
  registerPartDivision,
  removePartDivision,
  reorderParts,
  updatePart,
  updatePartDivision,
} from './part-use-cases';
import {
  listSections,
  listSectionPartIds,
  listSectionPartIdsByGroup,
  registerSection,
  removeSection,
  reorderSections,
  updateSection,
} from './section-use-cases';
export type EnsembleDeps = {
  groupRepo: GroupRepository;
  musicianRepo: MusicianRepository;
  partRepo: PartRepository;
  sectionRepo: SectionRepository;
  assignmentRepo: AssignmentRepository;
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
    deleteGroup: (organizationId: string, groupId: string) =>
      deleteGroup(deps.groupRepo, organizationId, groupId),
    archiveGroup: (organizationId: string, groupId: string) =>
      archiveGroup(deps.groupRepo, organizationId, groupId),
    restoreGroup: (organizationId: string, groupId: string) =>
      restoreGroup(deps.groupRepo, organizationId, groupId),
    reorderGroups: (organizationId: string, orderedGroupIds: string[]) =>
      reorderGroups(deps.groupRepo, organizationId, orderedGroupIds),
    updateGroupFileAccessSettings: (
      organizationId: string,
      groupId: string,
      input: GroupFileAccessInput,
    ) => updateGroupFileAccessSettings(deps.groupRepo, organizationId, groupId, input),

    listMusicians: (organizationId: string, options?: ListMusiciansOptions) =>
      listMusicians(deps.musicianRepo, organizationId, options),
    getMusician: (organizationId: string, musicianId: string) =>
      getMusician(deps.musicianRepo, organizationId, musicianId),
    getMyMusician: (organizationId: string, userId: string) =>
      getMyMusician(deps.musicianRepo, organizationId, userId),
    updateMusician: (organizationId: string, musicianId: string, input: MusicianInput) =>
      updateMusician(deps.musicianRepo, organizationId, musicianId, input),
    createMusician: (organizationId: string, input: MusicianInput) =>
      createMusician(deps.musicianRepo, organizationId, input),
    mergeMusicians: (organizationId: string, sourceId: string, targetId: string) =>
      mergeMusicians(deps.musicianRepo, organizationId, sourceId, targetId),
    deleteMusician: (organizationId: string, musicianId: string) =>
      deleteMusician(deps.musicianRepo, organizationId, musicianId),

    listParts: (organizationId: string) => listParts(deps.partRepo, organizationId),
    getPart: (organizationId: string, partId: string) =>
      getPart(deps.partRepo, organizationId, partId),
    registerPart: (organizationId: string, input: PartInput) =>
      registerPart(deps.partRepo, organizationId, input),
    updatePart: (organizationId: string, partId: string, input: PartInput) =>
      updatePart(deps.partRepo, organizationId, partId, input),
    registerPartDivision: (organizationId: string, partId: string, input: PartDivisionInput) =>
      registerPartDivision(deps.partRepo, organizationId, partId, input),
    updatePartDivision: (
      organizationId: string,
      divisionId: string,
      input: PartDivisionInput,
    ) => updatePartDivision(deps.partRepo, organizationId, divisionId, input),
    removePartDivision: (organizationId: string, divisionId: string) =>
      removePartDivision(deps.partRepo, organizationId, divisionId),
    reorderParts: (organizationId: string, orderedPartIds: string[]) =>
      reorderParts(deps.partRepo, organizationId, orderedPartIds),

    listSections: (organizationId: string, groupId: string) =>      listSections(deps.sectionRepo, organizationId, groupId),
    listSectionPartIds: (organizationId: string, sectionId: string) =>
      listSectionPartIds(deps.sectionRepo, organizationId, sectionId),
    listSectionPartIdsByGroup: (organizationId: string, groupId: string) =>
      listSectionPartIdsByGroup(deps.sectionRepo, organizationId, groupId),
    registerSection: (organizationId: string, groupId: string, input: SectionInput) =>
      registerSection(deps.sectionRepo, organizationId, groupId, input),
    updateSection: (organizationId: string, sectionId: string, input: SectionInput) =>
      updateSection(deps.sectionRepo, organizationId, sectionId, input),
    removeSection: (organizationId: string, sectionId: string) =>
      removeSection(deps.sectionRepo, organizationId, sectionId),
    reorderSections: (organizationId: string, groupId: string, orderedSectionIds: string[]) =>
      reorderSections(deps.sectionRepo, organizationId, groupId, orderedSectionIds),

    listAssignmentsForMusician: (organizationId: string, musicianId: string) =>
      listAssignmentsForMusician(deps.assignmentRepo, organizationId, musicianId),
    listAssignmentsForGroup: (organizationId: string, groupId: string) =>
      listAssignmentsForGroup(deps.assignmentRepo, organizationId, groupId),
    assignMusician: (organizationId: string, musicianId: string, input: AssignmentInput) =>
      assignMusician(
        deps.assignmentRepo,
        deps.sectionRepo,
        organizationId,
        musicianId,
        input,
      ),
    updateAssignment: (organizationId: string, assignmentId: string, input: AssignmentInput) =>
      updateAssignment(
        deps.assignmentRepo,
        deps.sectionRepo,
        organizationId,
        assignmentId,
        input,
      ),
    removeAssignment: (organizationId: string, assignmentId: string) =>
      removeAssignment(deps.assignmentRepo, organizationId, assignmentId),
  };
}

export type EnsembleUseCases = ReturnType<typeof createEnsembleUseCases>;
