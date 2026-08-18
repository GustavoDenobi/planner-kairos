export const AGENDA_SECTION_QUERY = 'secao';

export type AgendaAdminSection = 'event-types';

const SECTION_QUERY_VALUES: Record<AgendaAdminSection, string> = {
  'event-types': 'tipos',
};

const QUERY_VALUE_TO_SECTION = Object.fromEntries(
  Object.entries(SECTION_QUERY_VALUES).map(([section, value]) => [value, section]),
) as Record<string, AgendaAdminSection>;

export function agendaSectionQueryValue(section: AgendaAdminSection): string {
  return SECTION_QUERY_VALUES[section];
}

export function parseAgendaSection(secao: string | null): AgendaAdminSection | null {
  if (!secao) {
    return null;
  }
  return QUERY_VALUE_TO_SECTION[secao] ?? null;
}

export function agendaPath(orgSlug: string, section?: AgendaAdminSection): string {
  if (!section) {
    return `/${orgSlug}/agenda`;
  }
  return `/${orgSlug}/agenda?${AGENDA_SECTION_QUERY}=${SECTION_QUERY_VALUES[section]}`;
}

export function eventPath(orgSlug: string, eventId: string): string {
  return `/${orgSlug}/eventos/${eventId}`;
}

export function repertoirePiecePath(orgSlug: string, pieceId: string): string {
  return `/${orgSlug}/repertorio/${pieceId}`;
}
