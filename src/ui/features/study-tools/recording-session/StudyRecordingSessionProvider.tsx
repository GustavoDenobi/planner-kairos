import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { StudyRecordingPageMark, StudyRecordingRecord } from '@/infrastructure/pwa/db';
import {
  addStudyRecording,
  appendStudyRecordingDraftChunk,
  createStudyRecordingDraft,
  deleteStudyRecordingDraft,
  listStudyRecordings,
  recoverStaleStudyRecordingDrafts,
  requestPersistentStorage,
} from '@/infrastructure/pwa/study-recording-store';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { Toast } from '@/ui/components/Toast';
import {
  buildDefaultStudyRecordingTitle,
  pickStudyRecordingMimeType,
  uniqueStudyRecordingTitle,
} from '@/ui/features/study-tools/study-recording-format';
import { appendStudyRecordingPageMark } from '@/ui/features/study-tools/recording-session/page-marks';
import { StudyRecordingSessionIndicator } from '@/ui/features/study-tools/recording-session/StudyRecordingSessionIndicator';
import {
  StudyRecordingElapsedContext,
  StudyRecordingSessionContext,
  type StartStudyRecordingOptions,
  type StudyRecordingSessionContextValue,
  type StudyRecordingSessionStatus,
  type StudyRecordingSessionValue,
} from '@/ui/features/study-tools/recording-session/recording-session-context';

const supportsRecorderPause =
  typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.prototype.pause === 'function';

const RECORDER_TIMESLICE_MS = 1000;
const DRAFT_FLUSH_INTERVAL_MS = 5000;
const ELAPSED_TICK_MS = 200;

/** Lê o status atual sem o estreitamento de tipo do TypeScript entre awaits. */
function readStatus(ref: { current: StudyRecordingSessionStatus }): StudyRecordingSessionStatus {
  return ref.current;
}

type ActiveSession = {
  draftId: string;
  organizationId: string;
  userId: string;
  title: string;
  mimeType: string;
  pieceId: string | null;
  pieceFileId: string | null;
  startPage: number | null;
  pageMarks: StudyRecordingPageMark[];
  practiceTaskId: string | null;
  practiceTaskTitle: string | null;
  /** Todos os trechos (para o arquivo final). */
  chunks: Blob[];
  /** Trechos ainda não gravados no rascunho do IndexedDB. */
  pendingChunks: Blob[];
  nextSeq: number;
};

export function StudyRecordingSessionProvider({ children }: { children: ReactNode }) {
  const { userId: authUserId } = useAuth();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef<ActiveSession | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftWriteChainRef = useRef<Promise<void>>(Promise.resolve());
  const statusRef = useRef<StudyRecordingSessionStatus>('idle');
  const persistRequestedRef = useRef(false);

  const [status, setStatusState] = useState<StudyRecordingSessionStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<StudyRecordingSessionContextValue | null>(null);
  const [recordingsVersion, setRecordingsVersion] = useState(0);
  const [controlsSurfaceCount, setControlsSurfaceCount] = useState(0);

  const setStatus = useCallback((next: StudyRecordingSessionStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const notifyRecordingsChanged = useCallback(() => {
    setRecordingsVersion((version) => version + 1);
  }, []);

  const currentElapsedMs = useCallback(() => {
    const startedAt = startedAtRef.current;
    return accumulatedMsRef.current + (startedAt === null ? 0 : Date.now() - startedAt);
  }, []);

  const clearTimers = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (flushTimerRef.current !== null) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
    }
    setElapsedMs(currentElapsedMs());
    tickRef.current = setInterval(() => setElapsedMs(currentElapsedMs()), ELAPSED_TICK_MS);
  }, [currentElapsedMs]);

  const stopStream = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  }, []);

  /** Enfileira escritas no rascunho para manter a ordem dos trechos. */
  const enqueueDraftWrite = useCallback((write: () => Promise<void>) => {
    const next = draftWriteChainRef.current.then(write).catch(() => {
      /* Rascunho é só uma rede de segurança; falhas não interrompem a gravação. */
    });
    draftWriteChainRef.current = next;
    return next;
  }, []);

  const flushDraft = useCallback(() => {
    const active = activeRef.current;
    if (!active) {
      return Promise.resolve();
    }
    const pending = active.pendingChunks;
    active.pendingChunks = [];
    const blob = new Blob(pending, { type: active.mimeType });
    const seq = active.nextSeq;
    active.nextSeq += 1;
    const draftId = active.draftId;
    const durationMs = currentElapsedMs();
    const pageMarks = [...active.pageMarks];
    return enqueueDraftWrite(() =>
      appendStudyRecordingDraftChunk({ draftId, seq, blob, durationMs, pageMarks }),
    );
  }, [currentElapsedMs, enqueueDraftWrite]);

  const resetSession = useCallback(() => {
    clearTimers();
    mediaRecorderRef.current = null;
    activeRef.current = null;
    startedAtRef.current = null;
    accumulatedMsRef.current = 0;
    setElapsedMs(0);
    setSession(null);
    setStatus('idle');
  }, [clearTimers, setStatus]);

  const discardDraft = useCallback(
    (draftId: string) => enqueueDraftWrite(() => deleteStudyRecordingDraft(draftId)),
    [enqueueDraftWrite],
  );

  const start = useCallback(
    async (options: StartStudyRecordingOptions) => {
      if (statusRef.current !== 'idle') {
        return;
      }

      if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador não suporta gravação de áudio.');
        return;
      }

      const mimeType = pickStudyRecordingMimeType();
      if (!mimeType) {
        setError('Este navegador não suporta um formato de gravação compatível.');
        return;
      }

      setError(null);
      // "starting" já reivindica o microfone: o afinador libera o dele antes do pedido.
      setStatus('starting');
      setSession({
        organizationId: options.organizationId,
        userId: options.userId,
        pieceId: options.pieceId ?? null,
        pieceFileId: options.pieceFileId ?? null,
        practiceTaskId: options.practiceTask?.id ?? null,
      });

      if (!persistRequestedRef.current) {
        persistRequestedRef.current = true;
        void requestPersistentStorage();
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch {
        resetSession();
        setError('Permissão do microfone negada.');
        return;
      }

      if (readStatus(statusRef) !== 'starting') {
        // Cancelado enquanto o navegador pedia permissão.
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      const startedAt = new Date();
      const prefix = options.titlePrefix?.trim();
      const baseTitle = prefix
        ? `${prefix} · ${buildDefaultStudyRecordingTitle(startedAt).replace(/^Gravação /, '')}`
        : buildDefaultStudyRecordingTitle(startedAt);

      const startPage = options.startPage ?? null;
      const pieceFileId = options.pieceFileId ?? null;
      const active: ActiveSession = {
        draftId: crypto.randomUUID(),
        organizationId: options.organizationId,
        userId: options.userId,
        title: baseTitle,
        mimeType,
        pieceId: options.pieceId ?? null,
        pieceFileId,
        startPage,
        pageMarks:
          pieceFileId && startPage !== null ? [{ atSec: 0, pieceFileId, page: startPage }] : [],
        practiceTaskId: options.practiceTask?.id ?? null,
        practiceTaskTitle: options.practiceTask?.title ?? null,
        chunks: [],
        pendingChunks: [],
        nextSeq: 0,
      };

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType });
      } catch {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        resetSession();
        setError('Não foi possível iniciar a gravação.');
        return;
      }

      streamRef.current = stream;
      activeRef.current = active;
      mediaRecorderRef.current = recorder;

      void enqueueDraftWrite(() =>
        createStudyRecordingDraft({
          id: active.draftId,
          organizationId: active.organizationId,
          userId: active.userId,
          title: active.title,
          mimeType,
          startedAt: startedAt.toISOString(),
          updatedAt: startedAt.toISOString(),
          durationMs: 0,
          pieceId: active.pieceId,
          pieceFileId: active.pieceFileId,
          startPage: active.startPage,
          pageMarks: active.pageMarks,
          practiceTaskId: active.practiceTaskId,
          practiceTaskTitle: active.practiceTaskTitle,
        }),
      );

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && activeRef.current === active) {
          active.chunks.push(event.data);
          active.pendingChunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError('Não foi possível continuar a gravação.');
      };

      recorder.start(RECORDER_TIMESLICE_MS);
      accumulatedMsRef.current = 0;
      startedAtRef.current = Date.now();
      setStatus('recording');
      startTick();
      flushTimerRef.current = setInterval(() => void flushDraft(), DRAFT_FLUSH_INTERVAL_MS);
    },
    [enqueueDraftWrite, flushDraft, resetSession, setStatus, startTick],
  );

  const stop = useCallback(async (): Promise<StudyRecordingRecord | null> => {
    const recorder = mediaRecorderRef.current;
    const active = activeRef.current;
    if (!recorder || !active || recorder.state === 'inactive') {
      stopStream();
      resetSession();
      return null;
    }

    const durationMs = currentElapsedMs();
    accumulatedMsRef.current = durationMs;
    startedAtRef.current = null;
    clearTimers();
    setElapsedMs(durationMs);
    setStatus('saving');

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    stopStream();

    const blob = new Blob(active.chunks, { type: active.mimeType });
    let saved: StudyRecordingRecord | null = null;

    try {
      if (blob.size > 0) {
        const existing = await listStudyRecordings(active.organizationId, active.userId);
        saved = await addStudyRecording({
          organizationId: active.organizationId,
          userId: active.userId,
          title: uniqueStudyRecordingTitle(
            active.title,
            existing.map((row) => row.title),
          ),
          durationMs,
          mimeType: active.mimeType,
          blob,
          pieceId: active.pieceId,
          pieceFileId: active.pieceFileId,
          startPage: active.startPage,
          pageMarks: active.pageMarks,
          practiceTaskId: active.practiceTaskId,
          practiceTaskTitle: active.practiceTaskTitle,
        });
      }
      await discardDraft(active.draftId);
    } catch {
      // O rascunho continua no IndexedDB e será recuperado depois.
      setError('Não foi possível salvar a gravação neste aparelho.');
    }

    resetSession();
    notifyRecordingsChanged();
    return saved;
  }, [
    clearTimers,
    currentElapsedMs,
    discardDraft,
    notifyRecordingsChanged,
    resetSession,
    setStatus,
    stopStream,
  ]);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    const active = activeRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    stopStream();
    if (active) {
      void discardDraft(active.draftId);
    }
    resetSession();
  }, [discardDraft, resetSession, stopStream]);

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !supportsRecorderPause) {
      return;
    }

    if (recorder.state === 'recording') {
      accumulatedMsRef.current = currentElapsedMs();
      startedAtRef.current = null;
      recorder.pause();
      if (tickRef.current !== null) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      setElapsedMs(accumulatedMsRef.current);
      setStatus('paused');
      void flushDraft();
      return;
    }

    if (recorder.state === 'paused') {
      recorder.resume();
      startedAtRef.current = Date.now();
      setStatus('recording');
      startTick();
    }
  }, [currentElapsedMs, flushDraft, setStatus, startTick]);

  const notePage = useCallback(
    (pieceFileId: string, page: number) => {
      const active = activeRef.current;
      const current = statusRef.current;
      if (!active || (current !== 'recording' && current !== 'paused')) {
        return;
      }
      active.pageMarks = appendStudyRecordingPageMark(active.pageMarks, {
        atSec: Math.round(currentElapsedMs() / 100) / 10,
        pieceFileId,
        page,
      });
    },
    [currentElapsedMs],
  );

  const registerControlsSurface = useCallback(() => {
    setControlsSurfaceCount((count) => count + 1);
    return () => setControlsSurfaceCount((count) => Math.max(0, count - 1));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const isSessionActive = status === 'recording' || status === 'paused';

  // Grava no rascunho o que estiver pendente quando a aba vai para segundo plano.
  useEffect(() => {
    if (!isSessionActive) {
      return;
    }

    function handleHidden() {
      if (document.visibilityState === 'hidden') {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
          try {
            recorder.requestData();
          } catch {
            /* Alguns navegadores recusam requestData em certos estados. */
          }
        }
        void flushDraft();
      }
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Navegadores antigos exigem returnValue para mostrar o aviso.
      event.returnValue = '';
    }

    document.addEventListener('visibilitychange', handleHidden);
    window.addEventListener('pagehide', handleHidden);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleHidden);
      window.removeEventListener('pagehide', handleHidden);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushDraft, isSessionActive]);

  // Recupera gravações de sessões interrompidas (aba fechada, travamento).
  useEffect(() => {
    if (!authUserId || statusRef.current !== 'idle') {
      return;
    }

    let cancelled = false;
    void recoverStaleStudyRecordingDrafts(authUserId)
      .then((recovered) => {
        if (!cancelled && recovered.length > 0) {
          notifyRecordingsChanged();
        }
      })
      .catch(() => {
        /* Recuperação é melhor esforço. */
      });

    return () => {
      cancelled = true;
    };
  }, [authUserId, notifyRecordingsChanged]);

  // Ao sair da conta, encerra a sessão sem perder o áudio.
  useEffect(() => {
    if (authUserId === null && activeRef.current) {
      void stop();
    }
  }, [authUserId, stop]);

  useEffect(
    () => () => {
      clearTimers();
      stopStream();
    },
    [clearTimers, stopStream],
  );

  const value = useMemo<StudyRecordingSessionValue>(
    () => ({
      status,
      error,
      supportsPause: supportsRecorderPause,
      isMicrophoneClaimed: status !== 'idle',
      isSessionActive,
      session,
      recordingsVersion,
      start,
      stop,
      cancel,
      togglePause,
      notePage,
      notifyRecordingsChanged,
      clearError,
      registerControlsSurface,
    }),
    [
      cancel,
      clearError,
      error,
      isSessionActive,
      notePage,
      notifyRecordingsChanged,
      recordingsVersion,
      registerControlsSurface,
      session,
      start,
      status,
      stop,
      togglePause,
    ],
  );

  return (
    <StudyRecordingSessionContext.Provider value={value}>
      <StudyRecordingElapsedContext.Provider value={elapsedMs}>
        {children}
        {isSessionActive || status === 'saving' ? (
          <StudyRecordingSessionIndicator hidden={controlsSurfaceCount > 0} />
        ) : null}
        {/* Erros do gravador (ex.: microfone negado) viram toast: não há espaço inline nas barras. */}
        <Toast message={error} onDismiss={clearError} />
      </StudyRecordingElapsedContext.Provider>
    </StudyRecordingSessionContext.Provider>
  );
}
