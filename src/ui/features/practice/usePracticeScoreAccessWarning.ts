import { useEffect, useState } from 'react';
import type { GroupFileAccessSettings } from '@/domain/ensemble';
import { resolvePracticeTaskStudents } from '@/domain/practice';
import { musiciansWithoutPieceFileAccess, type PieceDetail } from '@/domain/repertoire';
import { useEnsemble } from '@/ui/app/AppServicesContext';

export type ScoreAccessMusician = {
  musicianId: string;
  musicianName: string;
};

type MusicianOption = {
  id: string;
  name: string;
};

/**
 * Alunos da tarefa (grupos e indicados) que não abrem a partitura escolhida.
 * Professores e regentes do grupo ficam de fora, como no público da tarefa.
 */
export function usePracticeScoreAccessWarning(input: {
  organizationId: string;
  groupIds: string[];
  musicianIds: string[];
  musicians: MusicianOption[];
  piece: PieceDetail | null;
  pieceFileId: string | null;
}): ScoreAccessMusician[] {
  const ensemble = useEnsemble();
  const { organizationId, groupIds, musicianIds, musicians, piece, pieceFileId } = input;
  const [blocked, setBlocked] = useState<ScoreAccessMusician[]>([]);
  const [groupSettingsById, setGroupSettingsById] = useState<Map<
    string,
    GroupFileAccessSettings
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ensemble.listGroups(organizationId, { includeArchived: true }).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setGroupSettingsById(new Map());
        return;
      }
      setGroupSettingsById(
        new Map(
          result.value.map((group) => [
            group.id,
            {
              fileAccessScope: group.fileAccessScope,
              allowFileDownload: group.allowFileDownload,
              audioAccessScope: group.audioAccessScope,
              audioAllowDownload: group.audioAllowDownload,
              allowPieceAccessOverride: group.allowPieceAccessOverride,
            },
          ]),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [ensemble, organizationId]);

  const groupKey = groupIds.join('\0');
  const musicianKey = musicianIds.join('\0');
  const nameKey = musicians.map((musician) => `${musician.id}:${musician.name}`).join('\0');

  useEffect(() => {
    const file =
      piece && pieceFileId
        ? piece.files.find((item) => item.id === pieceFileId && item.kind === 'score')
        : undefined;
    const hasSelection = groupIds.length > 0 || musicianIds.length > 0;

    if (!file || !piece || !hasSelection || !groupSettingsById) {
      setBlocked([]);
      return;
    }

    const scoreFile = file;
    const groupSettings = groupSettingsById;
    const piecePartLinks = piece.partLinks ?? [];

    let cancelled = false;
    setBlocked([]);
    const pieceGroups = piece.groups.map((group) => group.id);
    const pieceMusicians = piece.musicians.map((musician) => musician.id);
    const pieceSettings = {
      fileAccessScope: piece.fileAccessScope,
      allowFileDownload: piece.allowFileDownload,
      audioAccessScope: piece.audioAccessScope,
      audioAllowDownload: piece.audioAllowDownload,
    };
    const nameById = new Map(musicians.map((musician) => [musician.id, musician.name]));

    async function load() {
      const groupResults = await Promise.all(
        groupIds.map((groupId) => ensemble.listAssignmentsForGroup(organizationId, groupId)),
      );
      if (cancelled) {
        return;
      }

      const students = resolvePracticeTaskStudents({
        groupIds,
        directMusicians: musicianIds.map((musicianId) => ({
          musicianId,
          musicianName: nameById.get(musicianId) ?? '',
        })),
        groupMembers: groupResults.flatMap((result) =>
          result.ok
            ? result.value.map((row) => ({
                musicianId: row.musicianId,
                musicianName: row.musicianName,
                groupId: row.groupId,
                ensembleRole: row.ensembleRole,
              }))
            : [],
        ),
      }).filter((student) => student.musicianName.trim().length > 0);

      if (students.length === 0) {
        setBlocked([]);
        return;
      }

      const assignmentsResult = await ensemble.listAssignmentsForMusicians(
        organizationId,
        students.map((student) => student.musicianId),
      );
      if (cancelled) {
        return;
      }
      if (!assignmentsResult.ok) {
        setBlocked([]);
        return;
      }

      const assignmentsByMusician = new Map<string, typeof assignmentsResult.value>();
      for (const assignment of assignmentsResult.value) {
        const list = assignmentsByMusician.get(assignment.musicianId) ?? [];
        list.push(assignment);
        assignmentsByMusician.set(assignment.musicianId, list);
      }

      setBlocked(
        musiciansWithoutPieceFileAccess({
          file: scoreFile,
          pieceGroupIds: pieceGroups,
          pieceMusicianIds: pieceMusicians,
          pieceSettings,
          piecePartLinks,
          groupSettingsById: groupSettings,
          musicians: students.map((student) => ({
            musicianId: student.musicianId,
            musicianName: student.musicianName,
            assignments: (assignmentsByMusician.get(student.musicianId) ?? []).map(
              (assignment) => ({
                groupId: assignment.groupId,
                ensembleRole: assignment.ensembleRole,
                partId: assignment.partId,
              }),
            ),
          })),
        }),
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    ensemble,
    groupKey,
    groupSettingsById,
    musicianKey,
    musicians,
    nameKey,
    organizationId,
    piece,
    pieceFileId,
    groupIds,
    musicianIds,
  ]);

  return blocked;
}
