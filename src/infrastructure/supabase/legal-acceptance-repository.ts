import type {
  LegalAcceptanceRepository,
  RecordLegalAcceptanceInput,
  OrganizationRulesAcceptanceListItem,
} from '@/application/ports/legal-acceptance-repository';
import type { LegalAcceptance } from '@/domain/identity/legal-documents';
import { supabase } from './client';

type LegalAcceptanceRow = {
  id: string;
  user_id: string;
  scope: 'platform' | 'organization';
  organization_id: string | null;
  document_type: string;
  document_version: string;
  context: string;
  accepted_at: string;
};

function mapRow(row: LegalAcceptanceRow): LegalAcceptance {
  return {
    id: row.id,
    userId: row.user_id,
    scope: row.scope,
    organizationId: row.organization_id,
    documentType: row.document_type as LegalAcceptance['documentType'],
    documentVersion: row.document_version,
    context: row.context as LegalAcceptance['context'],
    acceptedAt: new Date(row.accepted_at),
  };
}

export function createLegalAcceptanceRepository(): LegalAcceptanceRepository {
  return {
    async recordAcceptance(input: RecordLegalAcceptanceInput) {
      const { data, error } = await supabase
        .from('legal_acceptances')
        .insert({
          user_id: input.userId,
          scope: input.scope,
          organization_id: input.organizationId ?? null,
          document_type: input.documentType,
          document_version: input.documentVersion,
          context: input.context,
        })
        .select(
          'id, user_id, scope, organization_id, document_type, document_version, context, accepted_at',
        )
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'legal_acceptance_failed');
      }

      return mapRow(data as LegalAcceptanceRow);
    },

    async hasAcceptedVersion(userId, scope, documentType, documentVersion, organizationId) {
      let query = supabase
        .from('legal_acceptances')
        .select('id')
        .eq('user_id', userId)
        .eq('scope', scope)
        .eq('document_type', documentType)
        .eq('document_version', documentVersion)
        .limit(1);

      if (scope === 'organization') {
        query = query.eq('organization_id', organizationId ?? '');
      } else {
        query = query.is('organization_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data !== null;
    },

    async listLatestByUser(userId) {
      const { data, error } = await supabase
        .from('legal_acceptances')
        .select(
          'id, user_id, scope, organization_id, document_type, document_version, context, accepted_at',
        )
        .eq('user_id', userId)
        .order('accepted_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map((row) => mapRow(row as LegalAcceptanceRow));
    },

    async listOrganizationRulesAcceptances(organizationId, currentRulesVersion) {
      const { data, error } = await supabase
        .from('legal_acceptances')
        .select(
          `
          user_id,
          document_version,
          accepted_at,
          profiles!inner (
            display_name,
            email
          )
        `,
        )
        .eq('organization_id', organizationId)
        .eq('scope', 'organization')
        .eq('document_type', 'organization_rules')
        .order('accepted_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const latestByUser = new Map<string, OrganizationRulesAcceptanceListItem>();

      for (const row of data ?? []) {
        const profileRaw = row.profiles as
          | { display_name: string; email: string }
          | { display_name: string; email: string }[]
          | null;
        const profile = Array.isArray(profileRaw) ? (profileRaw[0] ?? null) : profileRaw;
        if (!profile || latestByUser.has(row.user_id)) {
          continue;
        }

        latestByUser.set(row.user_id, {
          userId: row.user_id,
          displayName: profile.display_name,
          email: profile.email,
          documentVersion: row.document_version,
          acceptedAt: new Date(row.accepted_at),
          isCurrentVersion: row.document_version === String(currentRulesVersion),
        });
      }

      return [...latestByUser.values()].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'pt-BR'),
      );
    },
  };
}
