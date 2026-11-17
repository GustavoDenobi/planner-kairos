import { useEffect, useState } from 'react';
import type { GroupFileAccessSettings } from '@/domain/ensemble';
import { resolvePracticeTaskStudents } from '@/domain/practice';
import { musiciansWithoutPieceAccess } from '@/domain/repertoire';
import { useEnsemble, useRepertoire } from '@/ui/app/AppServicesContext';

export type ProgramAccessMusician = {
  musicianId: string;
  musicianName: string;
};

export type ProgramAccessItem = {
  key: string;
  pieceId: string;
  unitFileIds: string[];
};

/**
 * Músicos da audiência do evento que não abrem a obra (ou o trecho) escolhido.
 * Professores e regentes dos grupos do evento ficam de fora, como nas tarefas.
 */
export function useEventProgramPieceAccessWarning(input: {
  organizationId: string;
  groupIds: string[];
  musicians: Array<{ id: string; fullName: string }>;
  items: ProgramAccessItem[];
  enabled: boolean;
}): Record<string, ProgramAccessMusician[]> {
  const ensemble = useEnsemble();
  const repertoire = useRepertoire();
  const { organizationId, groupIds, musicians, items, enabled } = input;
  const [blockedByKey, setBlockedByKey] = useState<Record<string, ProgramAccessMusician[]>>({});
  const [groupSettingsById, setGroupSettingsById] = useState<Map<
    string,
    GroupFileAccessSettings
  > | null>(null);

  useEffect(() => {
    if (!enabled) {
      setGroupSettingsById(null);
      return;
    }

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
  }, [enabled, ensemble, organizationId]);

  const groupKey = groupIds.join('\0');
  const musicianKey = musicians.map((musician) => `${musician.id}:${musician.fullName}`).join('\0');
  const itemKey = items
    .map((item) => `${item.key}:${item.pieceId}:${item.unitFileIds.join(',')}`)
    .join('\0');

  useEffect(() => {
    if (!enabled || !groupSettingsById || items.length === 0) {
      setBlockedByKey({});
      return;
    }

    const groupSettings = groupSettingsById;
    let cancelled = false;

    async function load() {
      const groupResults = await Promise.all(
        groupIds.map((groupId) => ensemble.listAssignmentsForGroup(organizationId, groupId)),
      );
      if (cancelled) {
        return;
      }

      const audience = resolvePracticeTaskStudents({
        groupIds,
        directMusicians: musicians.map((musician) => ({
          musicianId: musician.id,
          musicianName: musician.fullName,
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

      if (audience.length === 0) {
        setBlockedByKey({});
        return;
      }

      const assignmentsResult = await ensemble.listAssignmentsForMusicians(
        organizationId,
        audience.map((student) => student.musicianId),
      );
      if (cancelled || !assignmentsResult.ok) {
        if (!cancelled) {
          setBlockedByKey({});
        }
        return;
      }

      const assignmentsByMusician = new Map<string, typeof assignmentsResult.value>();
      for (const assignment of assignmentsResult.value) {
        const list = assignmentsByMusician.get(assignment.musicianId) ?? [];
        list.push(assignment);
        assignmentsByMusician.set(assignment.musicianId, list);
      }

      const subjects = audience.map((student) => ({
        musicianId: student.musicianId,
        musicianName: student.musicianName,
        assignments: (assignmentsByMusician.get(student.musicianId) ?? []).map((assignment) => ({
          groupId: assignment.groupId,
          ensembleRole: assignment.ensembleRole,
          partId: assignment.partId,
        })),
      }));

      const pieceIds = [...new Set(items.map((item) => item.pieceId))];
      const pieceResults = await Promise.all(
        pieceIds.map(async (pieceId) => {
          const result = await repertoire.getPiece(organizationId, pieceId);
          return [pieceId, result.ok ? result.value : null] as const;
        }),
      );
      if (cancelled) {
        return;
      }

      const piecesById = new Map(pieceResults);
      const next: Record<string, ProgramAccessMusician[]> = {};

      for (const item of items) {
        const piece = piecesById.get(item.pieceId);
        if (!piece) {
          next[item.key] = [];
          continue;
        }
        next[item.key] = musiciansWithoutPieceAccess({
          pieceGroupIds: piece.groups.map((group) => group.id),
          pieceMusicianIds: piece.musicians.map((musician) => musician.id),
          piecePartLinks: piece.partLinks,
          pieceSettings: {
            fileAccessScope: piece.fileAccessScope,
            allowFileDownload: piece.allowFileDownload,
            audioAccessScope: piece.audioAccessScope,
            audioAllowDownload: piece.audioAllowDownload,
          },
          groupSettingsById: groupSettings,
          files: piece.files,
          unitFileIds: item.unitFileIds,
          musicians: subjects,
        });
      }

      setBlockedByKey(next);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    ensemble,
    groupKey,
    groupSettingsById,
    itemKey,
    musicianKey,
    organizationId,
    repertoire,
  ]);

  return blockedByKey;
}
