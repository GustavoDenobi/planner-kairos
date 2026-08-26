export type EnsembleRole = 'member' | 'teacher' | 'section_lead' | 'conductor';

export const GROUP_WRITER_ROLES: readonly EnsembleRole[] = ['teacher', 'conductor'];

export function isGroupWriterRole(role: EnsembleRole): boolean {
  return GROUP_WRITER_ROLES.includes(role);
}

export type Assignment = {
  id: string;
  organizationId: string;
  musicianId: string;
  groupId: string;
  sectionId: string | null;
  partId: string | null;
  ensembleRole: EnsembleRole;
};

export type AssignmentInput = {
  groupId: string;
  sectionId?: string | null;
  partId?: string | null;
  ensembleRole: EnsembleRole;
};

export type AssignmentWithDetails = Assignment & {
  groupName: string;
  sectionName: string | null;
  partName: string | null;
};

export type GroupAssignmentListItem = AssignmentWithDetails & {
  musicianName: string;
  musicianPhone: string | null;
};

export type MusicianAssignmentSummary = {
  groupId: string;
  groupName: string;
  ensembleRole: EnsembleRole;
  sectionName: string | null;
  partName: string | null;
};

export function toMusicianAssignmentSummary(
  assignment: Pick<
    AssignmentWithDetails,
    'groupId' | 'groupName' | 'ensembleRole' | 'sectionName' | 'partName'
  >,
): MusicianAssignmentSummary {
  return {
    groupId: assignment.groupId,
    groupName: assignment.groupName,
    ensembleRole: assignment.ensembleRole,
    sectionName: assignment.sectionName,
    partName: assignment.partName,
  };
}
