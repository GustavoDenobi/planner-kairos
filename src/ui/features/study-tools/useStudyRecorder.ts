import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudyRecordingRecord } from '@/infrastructure/pwa/db';
import {
  addStudyRecording,
  deleteStudyRecording,
  listStudyRecordings,
} from '@/infrastructure/pwa/study-recording-store';
import {
  buildDefaultStudyRecordingTitle,
  pickStudyRecordingMimeType,
  uniqueStudyRecordingTitle,
} from '@/ui/features/study-tools/study-recording-format';

export type StudyRecorderStatus = 'idle' | 'recording' | 'paused';

type UseStudyRecorderOptions = {
  organizationId: string | null;
  userId: string | null;
  onBeforeStart?: () => void;
  onSessionActiveChange?: (active: boolean) => void;
};

const supportsRecorderPause =
  typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.prototype.pause === 'function';

export function useStudyRecorder({
  organizationId,
  userId,
  onBeforeStart,
  onSessionActiveChange,
}: UseStudyRecorderOptions) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef('');

  const [status, setStatus] = useState<StudyRecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<StudyRecordingRecord[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const clearTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const syncElapsed = useCallback(() => {
    const startedAt = startedAtRef.current;
    if (startedAt === null) {
      setElapsedMs(accumulatedMsRef.current);
      return;
    }
    setElapsedMs(accumulatedMsRef.current + (Date.now() - startedAt));
  }, []);

  const stopStream = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
  }, []);

  const resetSessionState = useCallback(() => {
    clearTick();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
    accumulatedMsRef.current = 0;
    mimeTypeRef.current = '';
    setElapsedMs(0);
    setStatus('idle');
    onSessionActiveChange?.(false);
  }, [clearTick, onSessionActiveChange]);

  const refreshRecordings = useCallback(async () => {
    if (!organizationId || !userId) {
      setRecordings([]);
      return;
    }

    setIsLoadingList(true);
    try {
      const rows = await listStudyRecordings(organizationId, userId);
      setRecordings(rows);
    } finally {
      setIsLoadingList(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    void refreshRecordings();
  }, [refreshRecordings]);

  const finalizeRecording = useCallback(async () => {
    const mimeType = mimeTypeRef.current || pickStudyRecordingMimeType() || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const durationMs = accumulatedMsRef.current;

    stopStream();
    resetSessionState();

    if (!organizationId || !userId || blob.size === 0) {
      return;
    }

    const title = uniqueStudyRecordingTitle(
      buildDefaultStudyRecordingTitle(),
      recordings.map((row) => row.title),
    );

    await addStudyRecording({
      organizationId,
      userId,
      title,
      durationMs,
      mimeType,
      blob,
    });
    await refreshRecordings();
  }, [organizationId, recordings, refreshRecordings, resetSessionState, stopStream, userId]);

  const cancelRecording = useCallback(() => {
    clearTick();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stopStream();
    resetSessionState();
  }, [clearTick, resetSessionState, stopStream]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      resetSessionState();
      stopStream();
      return;
    }

    const startedAt = startedAtRef.current;
    if (startedAt !== null) {
      accumulatedMsRef.current += Date.now() - startedAt;
      startedAtRef.current = null;
    }
    clearTick();

    recorder.onstop = () => {
      void finalizeRecording();
    };
    recorder.stop();
  }, [clearTick, finalizeRecording, resetSessionState, stopStream]);

  const startRecording = useCallback(async () => {
    if (status === 'recording' || status === 'paused') {
      return;
    }

    if (!organizationId || !userId) {
      setError('Entre na organização para gravar.');
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

    onBeforeStart?.();
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      stopStream();
      streamRef.current = stream;
      chunksRef.current = [];
      accumulatedMsRef.current = 0;
      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError('Não foi possível continuar a gravação.');
        stopRecording();
      };

      recorder.start(250);
      startedAtRef.current = Date.now();
      setStatus('recording');
      onSessionActiveChange?.(true);
      syncElapsed();
      clearTick();
      tickRef.current = setInterval(syncElapsed, 200);
    } catch {
      stopStream();
      resetSessionState();
      setError('Permissão do microfone negada.');
    }
  }, [
    clearTick,
    onBeforeStart,
    onSessionActiveChange,
    organizationId,
    resetSessionState,
    status,
    stopRecording,
    stopStream,
    syncElapsed,
    userId,
  ]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording' || !supportsRecorderPause) {
      return;
    }

    const startedAt = startedAtRef.current;
    if (startedAt !== null) {
      accumulatedMsRef.current += Date.now() - startedAt;
      startedAtRef.current = null;
    }

    recorder.pause();
    clearTick();
    syncElapsed();
    setStatus('paused');
  }, [clearTick, syncElapsed]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') {
      return;
    }

    recorder.resume();
    startedAtRef.current = Date.now();
    setStatus('recording');
    clearTick();
    tickRef.current = setInterval(syncElapsed, 200);
  }, [clearTick, syncElapsed]);

  const togglePause = useCallback(() => {
    if (status === 'recording') {
      pauseRecording();
      return;
    }
    if (status === 'paused') {
      resumeRecording();
    }
  }, [pauseRecording, resumeRecording, status]);

  const removeRecording = useCallback(
    async (id: string) => {
      await deleteStudyRecording(id);
      await refreshRecordings();
    },
    [refreshRecordings],
  );

  useEffect(
    () => () => {
      clearTick();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      stopStream();
      onSessionActiveChange?.(false);
    },
    [clearTick, onSessionActiveChange, stopStream],
  );

  return {
    status,
    elapsedMs,
    error,
    recordings,
    isLoadingList,
    supportsPause: supportsRecorderPause,
    startRecording,
    stopRecording,
    cancelRecording,
    togglePause,
    removeRecording,
    refreshRecordings,
    isSessionActive: status === 'recording' || status === 'paused',
  };
}
