export function normalizeSearchText(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function matchesSearchText(name: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  return normalizeSearchText(name).includes(normalizedQuery);
}
