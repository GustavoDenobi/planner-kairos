import type { RepertoireAdminSection } from '@/ui/features/repertoire/RepertoireAdminMenu';

export const REPERTOIRE_SECTION_QUERY = 'secao';

const SECTION_QUERY_VALUES: Record<RepertoireAdminSection, string> = {
  pieces: 'pecas',
  categories: 'categorias',
  themes: 'temas',
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
