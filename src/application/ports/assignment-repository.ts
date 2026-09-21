import type {
  Assignment,
  AssignmentInput,
  AssignmentWithDetails,
  GroupAssignmentListItem,
} from '@/domain/ensemble';

export type AssignmentAudienceRow = {
  musicianId: string;
  musicianName: string;
  musicianUserId: string | null;
  groupId: string;
};

export type AssignmentGroupingRow = {
  musicianId: string;
  musicianName: string;
  groupId: string;
  groupName: string;
  sectionId: string | null;
  sectionName: string | null;
  sectionSortOrder: number | null;
  partId: string | null;
  partName: string | null;
};

export type AssignmentRepository = {
  listForMusician(
    organizationId: string,
    musicianId: string,
  ): Promise<AssignmentWithDetails[]>;
  listForGroup(
    organizationId: string,
    groupId: string,
  ): Promise<GroupAssignmentListItem[]>;
  listForGroups(
    organizationId: string,
    groupIds: string[],
  ): Promise<AssignmentAudienceRow[]>;
  listGroupingRowsForGroups(
    organizationId: string,
    groupIds: string[],
  ): Promise<AssignmentGroupingRow[]>;
  listPartNamesByMusicianIds(
    organizationId: string,
    musicianIds: string[],
  ): Promise<Map<string, string[]>>;
  getById(organizationId: string, assignmentId: string): Promise<Assignment | null>;
  create(
    organizationId: string,
    musicianId: string,
    input: AssignmentInput,
  ): Promise<Assignment>;
  update(
    organizationId: string,
    assignmentId: string,
    input: AssignmentInput,
  ): Promise<Assignment>;
  remove(organizationId: string, assignmentId: string): Promise<void>;
};
