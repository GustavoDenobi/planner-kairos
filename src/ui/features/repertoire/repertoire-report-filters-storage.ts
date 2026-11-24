import { isRepertoireReportPeriod, type RepertoireReportPeriod } from '@/domain/repertoire';

export type RepertoireReportFilters = {
  period: RepertoireReportPeriod;
  groupIds: string[];
  eventTypeIds: string[];
  categoryIds: string[];
};

type StoredRepertoireReportFilters = RepertoireReportFilters & { savedAt: number };

const STORAGE_PREFIX = 'repertoire-report-filters';
const TTL_MS = 24 * 60 * 60 * 1000;

function storageKey(orgId: string): string {
  return `${STORAGE_PREFIX}:${orgId}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Filtros do relatório salvos há menos de 24h; expirados são descartados. */
export function loadRepertoireReportFilters(
  orgId: string,
  now: number = Date.now(),
): RepertoireReportFilters | null {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredRepertoireReportFilters>;
    if (
      typeof parsed.savedAt !== 'number' ||
      now - parsed.savedAt > TTL_MS ||
      !isRepertoireReportPeriod(parsed.period ?? null) ||
      !isStringArray(parsed.groupIds) ||
      !isStringArray(parsed.eventTypeIds) ||
      !isStringArray(parsed.categoryIds)
    ) {
      localStorage.removeItem(storageKey(orgId));
      return null;
    }
    return {
      period: parsed.period as RepertoireReportPeriod,
      groupIds: parsed.groupIds,
      eventTypeIds: parsed.eventTypeIds,
      categoryIds: parsed.categoryIds,
    };
  } catch {
    return null;
  }
}

export function saveRepertoireReportFilters(
  orgId: string,
  filters: RepertoireReportFilters,
  now: number = Date.now(),
): void {
  try {
    const stored: StoredRepertoireReportFilters = { ...filters, savedAt: now };
    localStorage.setItem(storageKey(orgId), JSON.stringify(stored));
  } catch {
    // Armazenamento indisponível: filtros só valem nesta visita.
  }
}
