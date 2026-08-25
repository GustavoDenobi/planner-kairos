import type { MusicianClaimRepository } from '@/application/ports/musician-claim-repository';
import type { EnsembleRole } from '@/domain/ensemble';
import type { MusicianClaimPreview } from '@/domain/identity';
import { mapOrganizationRules } from './map-organization-rules';
import { supabase } from './client';

function mapAssignmentPreview(row: {
  group_name: string;
  section_name: string | null;
  part_name: string | null;
  ensemble_role: string;
}) {
  return {
    groupName: row.group_name,
    sectionName: row.section_name,
    partName: row.part_name,
    ensembleRole: row.ensemble_role as EnsembleRole,
  };
}

export function createMusicianClaimRepository(): MusicianClaimRepository {
  return {
    async previewByMusicianId(musicianId) {
      const { data, error } = await supabase.rpc('get_musician_claim_preview', {
        p_musician_id: musicianId,
      });

      if (error || !data || data.length === 0) {
        return null;
      }

      const row = data[0];
      const assignmentsRaw = row.assignments;
      const assignments = Array.isArray(assignmentsRaw)
        ? assignmentsRaw.map((item) =>
            mapAssignmentPreview(
              item as {
                group_name: string;
                section_name: string | null;
                part_name: string | null;
                ensemble_role: string;
              },
            ),
          )
        : [];

      return {
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        organizationSlug: row.organization_slug,
        organizationImageStorageKey: row.organization_image_storage_key ?? null,
        musicianFullName: row.musician_full_name,
        alreadyClaimed: row.already_claimed,
        assignments,
        organizationRules: mapOrganizationRules({
          rules_title: row.rules_title ?? null,
          rules_markdown: row.rules_markdown ?? null,
          rules_version: row.rules_version ?? null,
          requires_rules_acceptance: row.requires_rules_acceptance ?? null,
        }),
      } satisfies MusicianClaimPreview;
    },

    async claim(musicianId, contact) {
      const { data, error } = await supabase.rpc('claim_musician', {
        p_musician_id: musicianId,
        p_display_name: contact.displayName,
        p_phone: contact.phone ?? null,
        p_birth_date: contact.birthDate ?? null,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        throw new Error('claim_failed');
      }

      return data[0].organization_slug;
    },
  };
}
