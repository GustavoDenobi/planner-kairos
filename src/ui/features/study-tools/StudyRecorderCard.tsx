import { useState } from 'react';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { IconMic, IconPause, IconPlay, IconRecord } from '@/ui/components/icons';
import {
  useStudyRecordingControlsSurface,
  useStudyRecordingElapsedMs,
  useStudyRecordingSession,
} from '@/ui/features/study-tools/recording-session/recording-session-context';
import {
  StudyRecordingList,
  studyRecordingIconButtonClass,
} from '@/ui/features/study-tools/StudyRecordingList';
import { formatTimerMs } from '@/ui/features/study-tools/study-timer-format';
import { useStudyRecordings } from '@/ui/features/study-tools/useStudyRecordings';

type StudyRecorderCardProps = {
  organizationId: string | null;
  userId: string | null;
};

function ElapsedBadge() {
  const elapsedMs = useStudyRecordingElapsedMs();
  return (
    <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-medium tabular-nums text-primary">
      {formatTimerMs(elapsedMs)}
    </span>
  );
}

export function StudyRecorderCard({ organizationId, userId }: StudyRecorderCardProps) {
  const recording = useStudyRecordingSession();
  const { recordings, removeRecording, renameRecording } = useStudyRecordings({
    organizationId,
    userId,
  });
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  useStudyRecordingControlsSurface();

  const isIdle = recording.status === 'idle';
  const isBusy = recording.status === 'starting' || recording.status === 'saving';

  function handleStart() {
    if (!organizationId || !userId) {
      return;
    }
    void recording.start({ organizationId, userId });
  }

  return (
    <section
      aria-labelledby="study-recorder-heading"
      className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2
            id="study-recorder-heading"
            className="flex items-center gap-2 text-base font-semibold text-text"
          >
            <IconMic className="h-5 w-5 shrink-0" aria-hidden />
            Gravador
          </h2>
        </div>
        {recording.isSessionActive || recording.status === 'saving' ? <ElapsedBadge /> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {isIdle || recording.status === 'starting' ? (
          <button
            type="button"
            onClick={handleStart}
            disabled={!organizationId || !userId || isBusy}
            aria-label="Iniciar gravação"
            className={`${studyRecordingIconButtonClass} h-9 w-auto gap-2 px-3`}
          >
            <IconRecord className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
            Gravar
          </button>
        ) : (
          <>
            {recording.supportsPause ? (
              <button
                type="button"
                onClick={recording.togglePause}
                disabled={isBusy}
                aria-label={recording.status === 'paused' ? 'Retomar gravação' : 'Pausar gravação'}
                className={studyRecordingIconButtonClass}
              >
                {recording.status === 'paused' ? (
                  <IconPlay className="h-4 w-4" />
                ) : (
                  <IconPause className="h-4 w-4" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setCancelConfirmOpen(true)}
              disabled={isBusy}
              aria-label="Cancelar gravação"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-text disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void recording.stop()}
              disabled={isBusy}
              aria-label="Encerrar e salvar gravação"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Salvar
            </button>
          </>
        )}
      </div>

      {recordings.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-medium text-text">Gravações salvas</h3>
          <div className="mt-2">
            <StudyRecordingList
              recordings={recordings}
              onRemove={removeRecording}
              onRename={renameRecording}
            />
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={cancelConfirmOpen}
        title="Cancelar gravação"
        message="Descartar esta gravação em andamento? Nada será salvo."
        confirmLabel="Descartar"
        onConfirm={() => {
          recording.cancel();
          setCancelConfirmOpen(false);
        }}
        onClose={() => setCancelConfirmOpen(false)}
      />
    </section>
  );
}
