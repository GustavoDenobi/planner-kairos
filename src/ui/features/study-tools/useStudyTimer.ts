import { useCallback, useEffect, useRef, useState } from 'react';
import { playStudyTimerCompleteSound } from '@/ui/features/study-tools/play-study-timer-complete-sound';
import {
  clampTimerSegment,
  countdownDurationMs,
  formatTimerMs,
} from '@/ui/features/study-tools/study-timer-format';

const TICK_MS = 100;

export type StudyTimerMode = 'progressive' | 'countdown';
export type StudyTimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export function useStudyTimer() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const carryMsRef = useRef(0);

  const [mode, setModeState] = useState<StudyTimerMode>('progressive');
  const [status, setStatus] = useState<StudyTimerStatus>('idle');
  const [displayMs, setDisplayMs] = useState(0);
  const [isAlerting, setIsAlerting] = useState(false);
  const [countdownMinutes, setCountdownMinutes] = useState(20);
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    runStartedAtRef.current = null;
  }, []);

  const finishCountdown = useCallback(() => {
    clearTick();
    carryMsRef.current = 0;
    setDisplayMs(0);
    setStatus('finished');
    setIsAlerting(true);
    void playStudyTimerCompleteSound();
  }, [clearTick]);

  const syncDisplay = useCallback(() => {
    const startedAt = runStartedAtRef.current;
    if (startedAt === null) {
      return;
    }

    const elapsed = Date.now() - startedAt + carryMsRef.current;

    if (mode === 'progressive') {
      setDisplayMs(elapsed);
      return;
    }

    const remaining = carryMsRef.current - (Date.now() - startedAt);
    if (remaining <= 0) {
      finishCountdown();
      return;
    }

    setDisplayMs(remaining);
  }, [finishCountdown, mode]);

  const startTick = useCallback(() => {
    clearTick();
    runStartedAtRef.current = Date.now();
    syncDisplay();
    intervalRef.current = setInterval(syncDisplay, TICK_MS);
  }, [clearTick, syncDisplay]);

  const pause = useCallback(() => {
    const startedAt = runStartedAtRef.current;
    if (startedAt === null) {
      return;
    }

    if (mode === 'progressive') {
      carryMsRef.current += Date.now() - startedAt;
      setDisplayMs(carryMsRef.current);
    } else {
      const remaining = carryMsRef.current - (Date.now() - startedAt);
      carryMsRef.current = Math.max(0, remaining);
      setDisplayMs(carryMsRef.current);
    }

    clearTick();
    setStatus('paused');
  }, [clearTick, mode]);

  const reset = useCallback(() => {
    clearTick();
    carryMsRef.current = 0;
    setDisplayMs(0);
    setStatus('idle');
    setIsAlerting(false);
  }, [clearTick]);

  const setMode = useCallback(
    (next: StudyTimerMode) => {
      if (status === 'running') {
        return;
      }
      reset();
      setModeState(next);
    },
    [reset, status],
  );

  const start = useCallback(() => {
    if (status === 'running') {
      return;
    }

    setIsAlerting(false);

    if (mode === 'countdown') {
      const durationMs =
        status === 'paused' && carryMsRef.current > 0
          ? carryMsRef.current
          : countdownDurationMs(countdownMinutes, countdownSeconds);

      if (durationMs <= 0) {
        return;
      }

      carryMsRef.current = durationMs;
      setDisplayMs(durationMs);
    } else if (status !== 'paused') {
      carryMsRef.current = 0;
      setDisplayMs(0);
    }

    setStatus('running');
    startTick();
  }, [countdownMinutes, countdownSeconds, mode, startTick, status]);

  const toggleRunning = useCallback(() => {
    if (status === 'running') {
      pause();
      return;
    }
    start();
  }, [pause, start, status]);

  const applyCountdownDuration = useCallback(
    (minutes: number, seconds: number) => {
      if (status === 'running') {
        return;
      }

      const nextMinutes = clampTimerSegment(minutes, 99);
      const nextSeconds = clampTimerSegment(seconds, 59);
      const durationMs = countdownDurationMs(nextMinutes, nextSeconds);
      if (durationMs <= 0) {
        return;
      }

      setCountdownMinutes(nextMinutes);
      setCountdownSeconds(nextSeconds);
      carryMsRef.current = durationMs;
      setDisplayMs(durationMs);

      if (status === 'finished') {
        setStatus('idle');
        setIsAlerting(false);
      }
    },
    [status],
  );

  useEffect(() => () => clearTick(), [clearTick]);

  const formattedTime = formatTimerMs(
    mode === 'countdown' && status === 'idle'
      ? countdownDurationMs(countdownMinutes, countdownSeconds)
      : displayMs,
  );

  const configuredCountdownMs = countdownDurationMs(countdownMinutes, countdownSeconds);
  const canStartCountdown =
    mode !== 'countdown' || status === 'paused' || configuredCountdownMs > 0;
  const canEditCountdownDuration = mode === 'countdown' && status !== 'running';

  return {
    mode,
    setMode,
    status,
    formattedTime,
    isAlerting,
    countdownMinutes,
    countdownSeconds,
    applyCountdownDuration,
    toggleRunning,
    reset,
    isRunning: status === 'running',
    canStartCountdown,
    canEditCountdownDuration,
  };
}
