import type { OrganizationRules } from '@/domain/identity/legal-documents';

export function mapOrganizationRules(row: {
  rules_title: string | null;
  rules_markdown: string | null;
  rules_version: number | null;
  requires_rules_acceptance: boolean | null;
}): OrganizationRules | null {
  const markdown = row.rules_markdown?.trim() ?? '';
  if (!markdown) {
    return null;
  }

  return {
    title: row.rules_title?.trim() || 'Regulamento',
    markdown,
    version: row.rules_version ?? 0,
    requiresAcceptance: row.requires_rules_acceptance ?? false,
  };
}
