import type { AgendaRangeMode } from '@/ui/features/agenda/agenda-date';

const STORAGE_KEY = 'planner-kairos:agenda-range';

type StoredAgendaRange = {
  mode: AgendaRangeMode;
  anchorIso: string;
};

export function loadAgendaRange(userId: string): StoredAgendaRange | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredAgendaRange;
    if (parsed.mode !== 'week' && parsed.mode !== 'month') {
      return null;
    }
    if (!parsed.anchorIso || Number.isNaN(new Date(parsed.anchorIso).getTime())) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveAgendaRange(userId: string, mode: AgendaRangeMode, anchor: Date): void {
  try {
    const payload: StoredAgendaRange = {
      mode,
      anchorIso: anchor.toISOString(),
    };
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}
