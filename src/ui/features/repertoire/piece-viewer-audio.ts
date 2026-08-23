import type { EnsembleUseCases } from '@/application/ensemble';
import type { RepertoireUseCases } from '@/application/repertoire';
import type { PieceFileWithLinks } from '@/domain/repertoire';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import type { GroupFileAccessSettings } from '@/domain/ensemble';
import {
  buildAccessiblePieceAudios,
  buildResolvedPieceAudioAccess,
  extractUserPartIds,
} from '@/ui/features/repertoire/resolve-piece-access-for-viewer';

export type PieceViewerAudioContext = {
  audios: PieceFileWithLinks[];
  parts: PartWithDivisions[];
};

export async function loadPieceViewerAudioContext(input: {
  repertoire: RepertoireUseCases;
  ensemble: EnsembleUseCases;
  organizationId: string;
  pieceId: string;
  isAdmin: boolean;
  userId: string | null;
  online: boolean;
}): Promise<PieceViewerAudioContext | null> {
  if (!input.online) {
    return null;
  }

  const [pieceResult, partsResult] = await Promise.all([
    input.repertoire.getPiece(input.organizationId, input.pieceId),
    input.ensemble.listParts(input.organizationId),
  ]);

  if (!pieceResult.ok) {
    return null;
  }

  const parts = partsResult.ok ? partsResult.value : [];

  if (input.isAdmin) {
    return {
      audios: pieceResult.value.files.filter((file) => file.kind === 'audio'),
      parts,
    };
  }

  if (!input.userId) {
    return { audios: [], parts };
  }

  const musicianResult = await input.ensemble.getMyMusician(input.organizationId, input.userId);
  const assignmentsResult = musicianResult.ok
    ? await input.ensemble.listAssignmentsForMusician(
        input.organizationId,
        musicianResult.value.id,
      )
    : null;
  const assignments = assignmentsResult?.ok ? assignmentsResult.value : [];

  const linkedGroupIds = pieceResult.value.groups.map((group) => group.id);
  const groupSettingsById = new Map<string, GroupFileAccessSettings>();
  await Promise.all(
    linkedGroupIds.map(async (groupId) => {
      const result = await input.ensemble.getGroup(input.organizationId, groupId);
      if (result.ok) {
        groupSettingsById.set(groupId, {
          fileAccessScope: result.value.fileAccessScope,
          allowFileDownload: result.value.allowFileDownload,
          audioAccessScope: result.value.audioAccessScope,
          audioAllowDownload: result.value.audioAllowDownload,
          allowPieceAccessOverride: result.value.allowPieceAccessOverride,
        });
      }
    }),
  );

  const userPartIds = extractUserPartIds(assignments);
  const audioAccess = buildResolvedPieceAudioAccess({
    isAdmin: false,
    piece: pieceResult.value,
    userMusicianId: musicianResult.ok ? musicianResult.value.id : null,
    assignments,
    groupSettingsById,
    userPartIds,
  });

  if (!audioAccess) {
    return { audios: [], parts };
  }

  const isConductor = linkedGroupIds.some((groupId) =>
    assignments.some(
      (assignment) =>
        assignment.groupId === groupId && assignment.ensembleRole === 'conductor',
    ),
  );

  return {
    audios: buildAccessiblePieceAudios(
      pieceResult.value,
      audioAccess,
      userPartIds,
      isConductor,
    ),
    parts,
  };
}
