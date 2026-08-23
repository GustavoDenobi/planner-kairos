import type { AssignmentWithDetails, GroupFileAccessSettings } from '@/domain/ensemble';
import type { PieceDetail, PieceFileWithLinks } from '@/domain/repertoire';
import {
  buildAccessPathsForUser,
  filterAccessibleAudioFiles,
  isUserConductorInLinkedGroups,
  resolvePieceAudioAccess,
  resolvePieceFileAccess,
  type ResolvedPieceFileAccess,
} from '@/domain/repertoire';

function buildPieceAccessContext(input: {
  isAdmin: boolean;
  piece: PieceDetail;
  userMusicianId: string | null;
  assignments: AssignmentWithDetails[];
  groupSettingsById: Map<string, GroupFileAccessSettings>;
  userPartIds: string[];
}) {
  const linkedGroupIds = input.piece.groups.map((group) => group.id);
  const linkedMusicianIds = input.piece.musicians.map((musician) => musician.id);
  const userGroupIds = input.assignments.map((assignment) => assignment.groupId);
  const hasAudience = linkedGroupIds.length > 0 || linkedMusicianIds.length > 0;
  const accessPaths = buildAccessPathsForUser({
    linkedGroupIds,
    linkedMusicianIds,
    userMusicianId: input.userMusicianId,
    userGroupIds,
    groupSettingsById: input.groupSettingsById,
  });
  const isInAudience = accessPaths.length > 0;

  return {
    isAdmin: input.isAdmin,
    userPartIds: input.userPartIds,
    isConductor: isUserConductorInLinkedGroups(linkedGroupIds, input.assignments),
    hasAudience,
    isInAudience,
    pieceSettings: {
      fileAccessScope: input.piece.fileAccessScope,
      allowFileDownload: input.piece.allowFileDownload,
      audioAccessScope: input.piece.audioAccessScope,
      audioAllowDownload: input.piece.audioAllowDownload,
    },
    accessPaths,
  };
}

export function buildResolvedPieceFileAccess(input: {
  isAdmin: boolean;
  piece: PieceDetail;
  userMusicianId: string | null;
  assignments: AssignmentWithDetails[];
  groupSettingsById: Map<string, GroupFileAccessSettings>;
}): ResolvedPieceFileAccess | null {
  return resolvePieceFileAccess(
    buildPieceAccessContext({
      ...input,
      userPartIds: [],
    }),
  );
}

export function buildResolvedPieceAudioAccess(input: {
  isAdmin: boolean;
  piece: PieceDetail;
  userMusicianId: string | null;
  assignments: AssignmentWithDetails[];
  groupSettingsById: Map<string, GroupFileAccessSettings>;
  userPartIds: string[];
}): ResolvedPieceFileAccess | null {
  return resolvePieceAudioAccess(buildPieceAccessContext(input));
}

export function buildAccessiblePieceAudios(
  piece: PieceDetail,
  audioAccess: ResolvedPieceFileAccess,
  userPartIds: string[],
  isConductor: boolean,
): PieceFileWithLinks[] {
  return filterAccessibleAudioFiles(piece.files, audioAccess, userPartIds, isConductor);
}

export function extractUserPartIds(assignments: AssignmentWithDetails[]): string[] {
  const partIds = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.partId) {
      partIds.add(assignment.partId);
    }
  }
  return [...partIds];
}
