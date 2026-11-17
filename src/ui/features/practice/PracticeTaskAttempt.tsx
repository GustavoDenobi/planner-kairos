import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PracticeSubmission, PracticeTask } from '@/domain/practice';
import { isDailyPracticeTask, practiceDailyPeriodFor } from '@/domain/practice';
import type { StudyRecordingRecord } from '@/infrastructure/pwa/db';
import { markStudyRecordingSubmitted } from '@/infrastructure/pwa/study-recording-store';
import { usePractice } from '@/ui/app/AppServicesContext';
import { IconLoader, IconPause, IconPlay, IconRecord, IconTrash } from '@/ui/components/icons';
import { formatPracticeDateTime, practiceErrorMessage } from '@/ui/features/practice/practice-labels';
import { practiceReaderPath } from '@/ui/features/practice/practice-routes';
import { PdfViewerRecorderActiveControls } from '@/ui/features/repertoire/PdfViewerRecorderBar';
import {
  useStudyRecordingControlsSurface,
  useStudyRecordingSession,
} from '@/ui/features/study-tools/recording-session/recording-session-context';
import { formatTimerMs } from '@/ui/features/study-tools/study-timer-format';
import { useStudyRecordings } from '@/ui/features/study-tools/useStudyRecordings';

const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
const inCardButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-bg px-4 py-2 text-sm font-medium text-text hover:border-primary/40 disabled:opacity-50';
const iconButtonClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text disabled:opacity-40';

/**
 * Gravações feitas nesta tarefa e ainda não enviadas (as únicas que podem ser enviadas).
 * Na tarefa diária, só as do dia em aberto: gravação de outro dia não vale como entrega.
 */
export function usePracticeTaskTakes(
  organizationId: string,
  userId: string,
  task: Pick<PracticeTask, 'id' | 'cadence' | 'daily' | 'timeZone'>,
) {
  const { recordings, isLoading, removeRecording } = useStudyRecordings({
    organizationId,
    userId,
    practiceTaskId: task.id,
  });
  const takes = useMemo(() => {
    if (!isDailyPracticeTask(task)) {
      return recordings;
    }
    const now = new Date();
    return recordings.filter(
      (take) =>
        practiceDailyPeriodFor({
          schedule: task.daily,
          timeZone: task.timeZone,
          recordedAt: new Date(take.createdAt),
          at: now,
        }) !== null,
    );
  }, [recordings, task]);
  return { takes, isLoading, removeTake: removeRecording };
}

type PracticeTakeSenderProps = {
  organizationId: string;
  userId: string;
  task: PracticeTask;
  takes: StudyRecordingRecord[];
  onRemoveTake: (id: string) => Promise<void>;
  onSubmitted: (submission: PracticeSubmission) => void;
};

/** Ouvir as gravações desta tentativa, escolher uma e enviar ao professor. */
export function PracticeTakeSender({
  organizationId,
  userId,
  task,
  takes,
  onRemoveTake,
  onSubmitted,
}: PracticeTakeSenderProps) {
  const practice = usePractice();
  const { notifyRecordingsChanged } = useStudyRecordingSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  // A gravação mais recente vem escolhida (normalmente é a que acabou de ser feita).
  const selected = takes.find((take) => take.id === selectedId) ?? takes[0] ?? null;

  function stopPlayback() {
    audioRef.current?.pause();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setPlayingId(null);
  }

  useEffect(() => stopPlayback, []);

  function togglePlay(take: StudyRecordingRecord) {
    if (playingId === take.id) {
      stopPlayback();
      return;
    }
    stopPlayback();
    const url = URL.createObjectURL(take.blob);
    urlRef.current = url;
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.src = url;
    audio.onended = stopPlayback;
    void audio.play();
    setPlayingId(take.id);
  }

  async function handleSend() {
    if (!selected) {
      return;
    }
    stopPlayback();
    setIsSending(true);
    setError(null);
    const result = await practice.submitRecording(organizationId, userId, task.id, {
      blob: selected.blob,
      mimeType: selected.mimeType,
      durationMs: selected.durationMs,
      pageMarks: selected.pageMarks ?? [],
      studentNote: note,
      recordedAt: selected.createdAt,
    });
    if (!result.ok) {
      setIsSending(false);
      setError(practiceErrorMessage(result.error));
      return;
    }
    await markStudyRecordingSubmitted(selected.id, result.value.id).catch(() => undefined);
    setIsSending(false);
    setNote('');
    notifyRecordingsChanged();
    onSubmitted(result.value);
  }

  if (takes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {takes.map((take) => {
          const isSelected = take.id === selected?.id;
          return (
            <li key={take.id}>
              <div
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border bg-bg'
                }`}
              >
                <button
                  type="button"
                  onClick={() => togglePlay(take)}
                  aria-label={playingId === take.id ? 'Pausar' : 'Ouvir gravação'}
                  className={iconButtonClass}
                >
                  {playingId === take.id ? (
                    <IconPause className="h-4 w-4" />
                  ) : (
                    <IconPlay className="h-4 w-4" />
                  )}
                </button>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  {takes.length > 1 ? (
                    <input
                      type="radio"
                      name={`practice-take-${task.id}`}
                      checked={isSelected}
                      onChange={() => setSelectedId(take.id)}
                    />
                  ) : null}
                  <span className="min-w-0 text-sm">
                    <span className="block font-medium text-text tabular-nums">
                      {formatTimerMs(take.durationMs)}
                    </span>
                    <span className="block text-xs text-muted">
                      gravada em {formatPracticeDateTime(take.createdAt)}
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (playingId === take.id) {
                      stopPlayback();
                    }
                    void onRemoveTake(take.id);
                  }}
                  disabled={isSending}
                  aria-label="Descartar gravação"
                  className={iconButtonClass}
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">Recado para o professor (opcional)</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={1000}
          disabled={isSending}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
        />
      </label>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={isSending || !selected}
        className={`${primaryButtonClass} w-full`}
      >
        {isSending ? <IconLoader className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {isSending ? 'Enviando…' : 'Enviar ao professor'}
      </button>
    </div>
  );
}

/** Controles da gravação em andamento, mostrados no card (o indicador global some). */
function AttemptActiveRecording() {
  useStudyRecordingControlsSurface();
  return (
    <div className="flex justify-center rounded-lg border border-border bg-bg px-3 py-2">
      <PdfViewerRecorderActiveControls />
    </div>
  );
}

type PracticeTaskAttemptProps = {
  orgSlug: string;
  organizationId: string;
  userId: string;
  task: PracticeTask;
  onSubmitted: (submission: PracticeSubmission) => void;
};

/**
 * Tentativa do aluno na página da tarefa: gravar aqui (ou no trecho da partitura),
 * ouvir e enviar. Só gravações feitas dentro da tarefa podem ser enviadas.
 */
export function PracticeTaskAttempt({
  orgSlug,
  organizationId,
  userId,
  task,
  onSubmitted,
}: PracticeTaskAttemptProps) {
  const recording = useStudyRecordingSession();
  const { takes, removeTake } = usePracticeTaskTakes(organizationId, userId, task);
  const practiceTask = useMemo(() => ({ id: task.id, title: task.title }), [task.id, task.title]);

  const isBusy = recording.isMicrophoneClaimed;
  const isThisTask = recording.session?.practiceTaskId === task.id;
  const isStarting = recording.status === 'starting';

  function startHere() {
    void recording.start({
      organizationId,
      userId,
      titlePrefix: task.title,
      practiceTask,
    });
  }

  if (isBusy && isThisTask && !isStarting) {
    return <AttemptActiveRecording />;
  }

  const readerLink =
    task.reference.kind === 'file' ? practiceReaderPath(orgSlug, task.id, task.reference) : null;
  const hasTakes = takes.length > 0;

  const recordHereButton = (
    <button
      type="button"
      onClick={startHere}
      disabled={isBusy}
      className={hasTakes || readerLink ? inCardButtonClass : primaryButtonClass}
    >
      {isStarting && isThisTask ? (
        <IconLoader className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <IconRecord className={`h-4 w-4 ${hasTakes || readerLink ? 'text-red-600' : ''}`} />
      )}
      {hasTakes ? 'Gravar de novo' : readerLink ? 'Gravar sem a partitura' : 'Gravar'}
    </button>
  );

  return (
    <div className="space-y-3">
      {hasTakes ? (
        <PracticeTakeSender
          organizationId={organizationId}
          userId={userId}
          task={task}
          takes={takes}
          onRemoveTake={removeTake}
          onSubmitted={onSubmitted}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {readerLink && !hasTakes ? (
          <Link to={readerLink} className={primaryButtonClass}>
            <IconRecord className="h-4 w-4" />
            Gravar no trecho
          </Link>
        ) : null}
        {recordHereButton}
      </div>

      {isBusy && !isThisTask ? (
        <p className="text-xs text-muted">Há uma gravação em andamento em outra tela.</p>
      ) : !hasTakes ? (
        <p className="text-xs text-muted">
          Só gravações feitas aqui na tarefa podem ser enviadas. Grave quantas vezes quiser e
          escolha qual mandar.
        </p>
      ) : null}
    </div>
  );
}
