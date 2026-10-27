export function clampTimerSegment(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(max, Math.max(0, Math.floor(value)));
}

export function countdownDurationMs(minutes: number, seconds: number): number {
  const m = clampTimerSegment(minutes, 99);
  const s = clampTimerSegment(seconds, 59);
  return (m * 60 + s) * 1000;
}

export const COUNTDOWN_DURATION_PRESETS_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const;

export function adjustCountdownDraft(
  minutes: number,
  seconds: number,
  deltaMinutes: number,
  deltaSeconds: number,
): { minutes: number; seconds: number } {
  const maxTotalSec = 99 * 60 + 59;
  let totalSec =
    clampTimerSegment(minutes, 99) * 60 + clampTimerSegment(seconds, 59) + deltaMinutes * 60 + deltaSeconds;
  totalSec = Math.min(maxTotalSec, Math.max(0, totalSec));

  return {
    minutes: Math.floor(totalSec / 60),
    seconds: totalSec % 60,
  };
}

export function isCountdownDurationValid(minutes: number, seconds: number): boolean {
  return countdownDurationMs(minutes, seconds) > 0;
}

export function formatTimerMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
