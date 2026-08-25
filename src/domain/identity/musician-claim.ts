import type { EnsembleRole } from '../ensemble/assignment';
import type { OrganizationRules } from './legal-documents';

export type MusicianClaimAssignmentPreview = {
  groupName: string;
  sectionName: string | null;
  partName: string | null;
  ensembleRole: EnsembleRole;
};

export type MusicianClaimPreview = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationImageStorageKey: string | null;
  musicianFullName: string;
  alreadyClaimed: boolean;
  assignments: MusicianClaimAssignmentPreview[];
  organizationRules: OrganizationRules | null;
};
