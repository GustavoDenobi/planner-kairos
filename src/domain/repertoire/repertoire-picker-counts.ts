import { isRepertoireUnlinkedFilter } from './repertoire-filters';

/** Uma obra visível ao usuário, com sua categoria e os grupos a que está vinculada. */
export type RepertoirePieceMembership = {
  pieceId: string;
  categoryId: string;
  groupIds: readonly string[];
};

export type RepertoireGroupCounts = {
  /** Todas as obras visíveis (o que a lista mostra sem filtro de grupo). */
  total: number;
  /** Obras sem nenhum grupo vinculado. */
  unlinked: number;
  byGroup: Map<string, number>;
};

export function countPiecesByGroup(
  memberships: readonly RepertoirePieceMembership[],
): RepertoireGroupCounts {
  const byGroup = new Map<string, number>();
  let unlinked = 0;

  for (const membership of memberships) {
    if (membership.groupIds.length === 0) {
      unlinked += 1;
      continue;
    }
    for (const groupId of new Set(membership.groupIds)) {
      byGroup.set(groupId, (byGroup.get(groupId) ?? 0) + 1);
    }
  }

  return { total: memberships.length, unlinked, byGroup };
}

/**
 * Restringe as obras ao escopo de grupo escolhido no seletor, com a mesma regra da busca:
 * '' = todas as obras visíveis; filtro "sem vínculo" = obras sem grupo; senão, obras do grupo.
 */
export function filterMembershipsByGroupScope(
  memberships: readonly RepertoirePieceMembership[],
  groupScope: string,
): RepertoirePieceMembership[] {
  if (!groupScope) {
    return [...memberships];
  }
  if (isRepertoireUnlinkedFilter(groupScope)) {
    return memberships.filter((membership) => membership.groupIds.length === 0);
  }
  return memberships.filter((membership) => membership.groupIds.includes(groupScope));
}

export function countPiecesByCategory(
  memberships: readonly RepertoirePieceMembership[],
): Map<string, number> {
  const byCategory = new Map<string, number>();
  for (const membership of memberships) {
    byCategory.set(membership.categoryId, (byCategory.get(membership.categoryId) ?? 0) + 1);
  }
  return byCategory;
}

export type RepertoireGroupChoices = {
  counts: RepertoireGroupCounts;
  /** Grupos com ao menos uma obra, na ordem recebida. */
  visibleGroupIds: string[];
  /** Mostrar "sem vínculo": permitido e com obras. */
  showUnlinked: boolean;
  /** Opções reais além de "Todos". Com 1 ou menos, "Todos" equivale à única opção. */
  choiceCount: number;
};

export function resolveRepertoireGroupChoices(
  memberships: readonly RepertoirePieceMembership[],
  groupIds: readonly string[],
  allowUnlinked: boolean,
): RepertoireGroupChoices {
  const counts = countPiecesByGroup(memberships);
  const visibleGroupIds = groupIds.filter((groupId) => (counts.byGroup.get(groupId) ?? 0) > 0);
  const showUnlinked = allowUnlinked && counts.unlinked > 0;
  return {
    counts,
    visibleGroupIds,
    showUnlinked,
    choiceCount: visibleGroupIds.length + (showUnlinked ? 1 : 0),
  };
}

export type RepertoireCategoryChoices = {
  /** Obras no escopo de grupo (o que "Todas" mostra). */
  scopedTotal: number;
  countsByCategory: Map<string, number>;
  /** Categorias com ao menos uma obra no escopo, na ordem recebida. */
  visibleCategoryIds: string[];
  unlinkedCount: number;
  /** Mostrar "sem vínculo": só no escopo "todos os grupos" (dentro de um grupo é sempre 0 e,
   * no escopo "sem vínculo", repetiria "Todas"). */
  showUnlinked: boolean;
  /** Opções reais além de "Todas". Com 1 ou menos, "Todas" equivale à única opção. */
  choiceCount: number;
};

export function resolveRepertoireCategoryChoices(
  memberships: readonly RepertoirePieceMembership[],
  categoryIds: readonly string[],
  groupScope: string,
  allowUnlinked: boolean,
): RepertoireCategoryChoices {
  const scoped = filterMembershipsByGroupScope(memberships, groupScope);
  const countsByCategory = countPiecesByCategory(scoped);
  const visibleCategoryIds = categoryIds.filter(
    (categoryId) => (countsByCategory.get(categoryId) ?? 0) > 0,
  );
  const unlinkedCount = scoped.filter((membership) => membership.groupIds.length === 0).length;
  const showUnlinked = allowUnlinked && groupScope === '' && unlinkedCount > 0;
  return {
    scopedTotal: scoped.length,
    countsByCategory,
    visibleCategoryIds,
    unlinkedCount,
    showUnlinked,
    choiceCount: visibleCategoryIds.length + (showUnlinked ? 1 : 0),
  };
}
