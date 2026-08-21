import type { AssignmentWithDetails, GroupFileAccessSettings } from '@/domain/ensemble';
import type { PieceDetail } from '@/domain/repertoire';
import {
  buildAccessPathsForUser,
  isUserConductorInLinkedGroups,
  resolvePieceFileAccess,
  type ResolvedPieceFileAccess,
} from '@/domain/repertoire';

export function buildResolvedPieceFileAccess(input: {
  isAdmin: boolean;
  piece: PieceDetail;
  userMusicianId: string | null;
  assignments: AssignmentWithDetails[];
  groupSettingsById: Map<string, GroupFileAccessSettings>;
}): ResolvedPieceFileAccess | null {
  const linkedGroupIds = input.piece.groups.map((group) => group.id);
  const linkedMusicianIds = input.piece.musicians.map((musician) => musician.id);
  const userGroupIds = input.assignments.map((assignment) => assignment.groupId);
  const hasAudience = linkedGroupIds.length > 0 || linkedMusicianIds.length > 0;
  const isInAudience = buildAccessPathsForUser({
    linkedGroupIds,
    linkedMusicianIds,
    userMusicianId: input.userMusicianId,
    userGroupIds,
    groupSettingsById: input.groupSettingsById,
  }).length > 0;

  return resolvePieceFileAccess({
    isAdmin: input.isAdmin,
    userPartIds: [],
    isConductor: isUserConductorInLinkedGroups(linkedGroupIds, input.assignments),
    hasAudience,
    isInAudience,
    pieceSettings: {
      fileAccessScope: input.piece.fileAccessScope,
      allowFileDownload: input.piece.allowFileDownload,
    },
    accessPaths: buildAccessPathsForUser({
      linkedGroupIds,
      linkedMusicianIds,
      userMusicianId: input.userMusicianId,
      userGroupIds,
      groupSettingsById: input.groupSettingsById,
    }),
  });
}
