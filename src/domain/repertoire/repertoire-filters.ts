export const REPERTOIRE_UNLINKED_FILTER = '__unlinked__';

export function isRepertoireUnlinkedFilter(value: string): boolean {
  return value === REPERTOIRE_UNLINKED_FILTER;
}

export function resolveRepertoireSearchFilters(groupId: string, categoryId: string) {
  const unlinkedOnly =
    isRepertoireUnlinkedFilter(groupId) || isRepertoireUnlinkedFilter(categoryId);

  return {
    unlinkedOnly,
    groupId:
      groupId && !isRepertoireUnlinkedFilter(groupId) && groupId !== ''
        ? groupId
        : undefined,
    categoryId:
      categoryId && !isRepertoireUnlinkedFilter(categoryId) && categoryId !== ''
        ? categoryId
        : undefined,
  };
}
