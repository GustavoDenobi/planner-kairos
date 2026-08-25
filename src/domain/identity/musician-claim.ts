import type { EnsembleRole } from '../ensemble/assignment';

export type MusicianClaimAssignmentPreview = {
  groupName: string;
  sectionName: string | null;
  partName: string | null;
  ensembleRole: EnsembleRole;
};

export type MusicianClaimPreview = {
  organizationName: string;
  organizationSlug: string;
  organizationImageStorageKey: string | null;
  musicianFullName: string;
  alreadyClaimed: boolean;
  assignments: MusicianClaimAssignmentPreview[];
};
