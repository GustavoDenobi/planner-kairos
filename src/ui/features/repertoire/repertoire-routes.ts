import type { RepertoireAdminSection } from '@/ui/features/repertoire/RepertoireAdminMenu';

export const REPERTOIRE_SECTION_QUERY = 'secao';

const SECTION_QUERY_VALUES: Record<RepertoireAdminSection, string> = {
  pieces: 'pecas',
  categories: 'categorias',
  themes: 'temas',
  reports: 'relatorios',
};

const QUERY_VALUE_TO_SECTION = Object.fromEntries(
  Object.entries(SECTION_QUERY_VALUES).map(([section, value]) => [value, section]),
) as Record<string, RepertoireAdminSection>;

export function repertoireSectionQueryValue(section: RepertoireAdminSection): string {
  return SECTION_QUERY_VALUES[section];
}

export function parseRepertoireSection(secao: string | null): RepertoireAdminSection | null {
  if (!secao) {
    return null;
  }
  return QUERY_VALUE_TO_SECTION[secao] ?? null;
}

export function repertoirePath(orgSlug: string, section?: RepertoireAdminSection): string {
  if (!section) {
    return `/${orgSlug}/repertorio`;
  }
  return `/${orgSlug}/repertorio?${REPERTOIRE_SECTION_QUERY}=${SECTION_QUERY_VALUES[section]}`;
}

/**
 * Estado da listagem de obras guardado na URL, para que "voltar" (do detalhe da obra,
 * por exemplo) reabra a mesma listagem: grupo, categoria, busca, tema e ordenação.
 */
export const REPERTOIRE_GROUP_QUERY = 'grupo';
export const REPERTOIRE_CATEGORY_QUERY = 'categoria';
export const REPERTOIRE_SEARCH_QUERY = 'busca';
export const REPERTOIRE_THEME_QUERY = 'tema';
export const REPERTOIRE_SORT_QUERY = 'ordem';

const ALL_GROUPS_QUERY_VALUE = 'todos';
const ALL_CATEGORIES_QUERY_VALUE = 'todas';

/** `null` = etapa ainda não escolhida; `''` = "todos"/"todas". */
export function readRepertoireGroupParam(params: URLSearchParams): string | null {
  return decodeScope(params.get(REPERTOIRE_GROUP_QUERY), ALL_GROUPS_QUERY_VALUE);
}

export function readRepertoireCategoryParam(params: URLSearchParams): string | null {
  return decodeScope(params.get(REPERTOIRE_CATEGORY_QUERY), ALL_CATEGORIES_QUERY_VALUE);
}

export function encodeRepertoireGroupParam(groupId: string): string {
  return groupId || ALL_GROUPS_QUERY_VALUE;
}

export function encodeRepertoireCategoryParam(categoryId: string): string {
  return categoryId || ALL_CATEGORIES_QUERY_VALUE;
}

function decodeScope(value: string | null, allValue: string): string | null {
  if (value === null) {
    return null;
  }
  return value === allValue ? '' : value;
}
