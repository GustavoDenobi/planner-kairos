export type RepertoireMemberFilters = {
  categoryId: string;
  groupId: string;
};

const STORAGE_PREFIX = 'repertoire-filters';

function storageKey(orgId: string, userId: string): string {
  return `${STORAGE_PREFIX}:${orgId}:${userId}`;
}

export function loadRepertoireMemberFilters(
  orgId: string,
  userId: string,
): RepertoireMemberFilters | null {
  try {
    const raw = localStorage.getItem(storageKey(orgId, userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<RepertoireMemberFilters>;
    if (typeof parsed.categoryId === 'string') {
      return {
        categoryId: parsed.categoryId,
        groupId: typeof parsed.groupId === 'string' ? parsed.groupId : '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveRepertoireMemberFilters(
  orgId: string,
  userId: string,
  filters: RepertoireMemberFilters,
): void {
  localStorage.setItem(storageKey(orgId, userId), JSON.stringify(filters));
}
