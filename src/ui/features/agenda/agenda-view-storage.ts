const STORAGE_KEY = 'planner-kairos:agenda-view';

export type AgendaViewMode = 'list' | 'columns';

export type StoredAgendaViewPreference = AgendaViewMode | null;

function isViewMode(value: unknown): value is AgendaViewMode {
  return value === 'list' || value === 'columns';
}

export function loadAgendaViewPreference(userId: string): StoredAgendaViewPreference {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { mode?: unknown };
    if (parsed.mode === null) {
      return null;
    }
    if (!isViewMode(parsed.mode)) {
      return null;
    }
    return parsed.mode;
  } catch {
    return null;
  }
}

export function saveAgendaViewPreference(
  userId: string,
  mode: StoredAgendaViewPreference,
): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify({ mode }));
  } catch {
    // ignore storage errors
  }
}
