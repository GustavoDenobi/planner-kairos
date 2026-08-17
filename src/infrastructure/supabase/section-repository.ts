import type { SectionRepository } from '@/application/ports/section-repository';
import type { Section, SectionInput, SectionListItem } from '@/domain/ensemble';
import { sortOrdersFromIds } from '@/domain/ensemble/sort-order';
import { supabase } from './client';

const SECTION_COLUMNS = 'id, organization_id, group_id, name, sort_order, notes';

function mapSection(row: {
  id: string;
  organization_id: string;
  group_id: string;
  name: string;
  sort_order: number;
  notes: string | null;
}): Section {
  return {
    id: row.id,
    organizationId: row.organization_id,
    groupId: row.group_id,
    name: row.name,
    sortOrder: row.sort_order,
    notes: row.notes,
  };
}

function mapSectionListItem(row: {
  id: string;
  organization_id: string;
  group_id: string;
  name: string;
  sort_order: number;
  notes: string | null;
  assignments: { count: number }[];
}): SectionListItem {
  return {
    ...mapSection(row),
    memberCount: row.assignments[0]?.count ?? 0,
  };
}

export function createSectionRepository(): SectionRepository {
  return {
    async listForGroup(organizationId, groupId) {
      const { data, error } = await supabase
        .from('sections')
        .select(`${SECTION_COLUMNS}, assignments(count)`)
        .eq('organization_id', organizationId)
        .eq('group_id', groupId)
        .order('sort_order')
        .order('name');

      if (error || !data) {
        return [];
      }

      return data.map((row) => {
        const assignments = row.assignments as { count: number } | { count: number }[];
        const count = Array.isArray(assignments)
          ? assignments[0]?.count ?? 0
          : assignments?.count ?? 0;

        return mapSectionListItem({
          ...row,
          assignments: [{ count }],
        });
      });
    },

    async getById(organizationId, sectionId) {
      const { data, error } = await supabase
        .from('sections')
        .select(SECTION_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('id', sectionId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapSection(data);
    },

    async create(organizationId, groupId, input: SectionInput) {
      const { data, error } = await supabase
        .from('sections')
        .insert({
          organization_id: organizationId,
          group_id: groupId,
          name: input.name,
          sort_order: input.sortOrder ?? 0,
          notes: input.notes ?? null,
        })
        .select(SECTION_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapSection(data);
    },

    async update(organizationId, sectionId, input: SectionInput) {
      const payload: {
        name: string;
        notes: string | null;
        sort_order?: number;
      } = {
        name: input.name,
        notes: input.notes ?? null,
      };

      if (input.sortOrder !== undefined) {
        payload.sort_order = input.sortOrder;
      }

      const { data, error } = await supabase
        .from('sections')
        .update(payload)        .eq('organization_id', organizationId)
        .eq('id', sectionId)
        .select(SECTION_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      return mapSection(data);
    },

    async remove(organizationId, sectionId) {
      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', sectionId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async reorderSections(organizationId, groupId, orderedSectionIds) {
      const sortOrders = sortOrdersFromIds(orderedSectionIds);

      const results = await Promise.all(
        [...sortOrders.entries()].map(([id, sortOrder]) =>
          supabase
            .from('sections')
            .update({ sort_order: sortOrder })
            .eq('organization_id', organizationId)
            .eq('group_id', groupId)
            .eq('id', id),
        ),
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error.message);
      }
    },

    async listPartIdsForSection(organizationId, sectionId) {
      const { data, error } = await supabase
        .from('section_parts')
        .select('part_id')
        .eq('organization_id', organizationId)
        .eq('section_id', sectionId);

      if (error || !data) {
        return [];
      }

      return data.map((row) => row.part_id);
    },

    async listPartIdsByGroup(organizationId, groupId) {
      const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('group_id', groupId);

      if (sectionsError || !sections || sections.length === 0) {
        return new Map();
      }

      const sectionIds = sections.map((section) => section.id);

      const { data, error } = await supabase
        .from('section_parts')
        .select('section_id, part_id')
        .eq('organization_id', organizationId)
        .in('section_id', sectionIds);

      if (error || !data) {
        return new Map();
      }

      const map = new Map<string, string[]>();
      for (const sectionId of sectionIds) {
        map.set(sectionId, []);
      }
      for (const row of data) {
        const ids = map.get(row.section_id) ?? [];
        ids.push(row.part_id);
        map.set(row.section_id, ids);
      }

      return map;
    },

    async setSectionParts(organizationId, sectionId, partIds) {
      const { error: deleteError } = await supabase
        .from('section_parts')
        .delete()
        .eq('organization_id', organizationId)
        .eq('section_id', sectionId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (partIds.length === 0) {
        return;
      }

      const { error: insertError } = await supabase.from('section_parts').insert(
        partIds.map((partId) => ({
          organization_id: organizationId,
          section_id: sectionId,
          part_id: partId,
        })),
      );

      if (insertError) {
        throw new Error(insertError.message);
      }
    },
  };
}