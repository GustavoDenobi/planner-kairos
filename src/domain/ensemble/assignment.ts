export type EnsembleRole = 'member' | 'teacher' | 'section_lead';

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
