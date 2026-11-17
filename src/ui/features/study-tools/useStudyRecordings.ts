import { useCallback, useEffect, useState } from 'react';
import type { StudyRecordingRecord } from '@/infrastructure/pwa/db';
import {
  deleteStudyRecording,
  listStudyRecordings,
  renameStudyRecording,
} from '@/infrastructure/pwa/study-recording-store';
import { useStudyRecordingSession } from '@/ui/features/study-tools/recording-session/recording-session-context';

type UseStudyRecordingsOptions = {
  organizationId: string | null;
  userId: string | null;
  /** Quando informado, lista só as gravações feitas neste arquivo. */
  pieceFileId?: string | null;
  /** Quando informado, lista só as gravações feitas nesta tarefa e ainda não enviadas. */
  practiceTaskId?: string | null;
};

/** Gravações locais do usuário, atualizadas quando a sessão salva ou recupera gravações. */
export function useStudyRecordings({
  organizationId,
  userId,
  pieceFileId = null,
  practiceTaskId = null,
}: UseStudyRecordingsOptions) {
  const { recordingsVersion, notifyRecordingsChanged } = useStudyRecordingSession();
  const [recordings, setRecordings] = useState<StudyRecordingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!organizationId || !userId) {
      setRecordings([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void listStudyRecordings(organizationId, userId)
      .then((rows) => {
        if (cancelled) {
          return;
        }
        setRecordings(
          rows.filter(
            (row) =>
              (!pieceFileId || row.pieceFileId === pieceFileId) &&
              (!practiceTaskId ||
                (row.practiceTaskId === practiceTaskId && !row.practiceSubmissionId)),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setRecordings([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, pieceFileId, practiceTaskId, recordingsVersion, userId]);

  const removeRecording = useCallback(
    async (id: string) => {
      await deleteStudyRecording(id);
      notifyRecordingsChanged();
    },
    [notifyRecordingsChanged],
  );

  const renameRecording = useCallback(
    async (id: string, title: string) => {
      const saved = await renameStudyRecording(id, title);
      if (saved !== null) {
        notifyRecordingsChanged();
      }
      return saved;
    },
    [notifyRecordingsChanged],
  );

  return { recordings, isLoading, removeRecording, renameRecording };
}
