export function compareByName(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export function nextSortOrder(items: { sortOrder: number }[]): number {
  if (items.length === 0) {
    return 1;
  }

  return Math.max(...items.map((item) => item.sortOrder)) + 1;
}

export function sortOrdersFromIds(orderedIds: string[]): Map<string, number> {
  return new Map(orderedIds.map((id, index) => [id, index + 1]));
}
