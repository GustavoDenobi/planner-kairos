import type { EventKind } from '@/domain/agenda';
import type { AgendaFilterScope } from '@/ui/features/agenda/AgendaFiltersBar';

const STORAGE_KEY = 'planner-kairos:agenda-filters';

export type StoredAgendaFilters = {
  scope: AgendaFilterScope;
  kind: EventKind | '';
  typeId: string;
  groupId: string;
};

const EVENT_KINDS: EventKind[] = ['rehearsal', 'service', 'class', 'special'];

function isScope(value: unknown): value is AgendaFilterScope {
  return value === 'mine' || value === 'all';
}

function isKind(value: unknown): value is EventKind | '' {
  return value === '' || (typeof value === 'string' && EVENT_KINDS.includes(value as EventKind));
}

export function loadAgendaFilters(userId: string): StoredAgendaFilters | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredAgendaFilters;
    if (!isScope(parsed.scope) || !isKind(parsed.kind)) {
      return null;
    }
    return {
      scope: parsed.scope,
      kind: parsed.kind,
      typeId: typeof parsed.typeId === 'string' ? parsed.typeId : '',
      groupId: typeof parsed.groupId === 'string' ? parsed.groupId : '',
    };
  } catch {
    return null;
  }
}

export function saveAgendaFilters(userId: string, filters: StoredAgendaFilters): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(filters));
  } catch {
    // ignore storage errors
  }
}
