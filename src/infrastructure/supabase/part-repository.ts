import type { PartRepository } from '@/application/ports/part-repository';
import type { Part, PartDivision, PartDivisionInput, PartInput } from '@/domain/ensemble';
import { compareByName, sortOrdersFromIds } from '@/domain/ensemble/sort-order';
import type { PartRemovalImpact, PartWithDivisions } from '@/application/ports/part-repository';
import { supabase } from './client';

const PART_COLUMNS =
  'id, organization_id, name, kind, sort_order, default_transpose_semitones';
const DIVISION_COLUMNS = 'id, organization_id, part_id, name, sort_order';

function mapPart(row: {
  id: string;
  organization_id: string;
  name: string;
  kind: Part['kind'];
  sort_order: number;
  default_transpose_semitones: number;
}): Part {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    kind: row.kind,
    sortOrder: row.sort_order,
    defaultTransposeSemitones: row.default_transpose_semitones,
  };
}

function mapDivision(row: {
  id: string;
  organization_id: string;
  part_id: string;
  name: string;
  sort_order: number;
}): PartDivision {
  return {
    id: row.id,
    organizationId: row.organization_id,
    partId: row.part_id,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

function sortDivisions(divisions: PartDivision[]): PartDivision[] {
  return [...divisions].sort((a, b) => compareByName(a.name, b.name));
}

export function createPartRepository(): PartRepository {
  return {
    async listForOrg(organizationId) {
      const { data: parts, error } = await supabase
        .from('parts')
        .select(PART_COLUMNS)
        .eq('organization_id', organizationId)
        .order('sort_order')
        .order('name');

      if (error || !parts) {
        return [];
      }

      const { data: divisions, error: divError } = await supabase
        .from('part_divisions')
        .select(DIVISION_COLUMNS)
        .eq('organization_id', organizationId)
        .order('name');

      const divisionsByPart = new Map<string, PartDivision[]>();

      if (!divError && divisions) {
        for (const row of divisions) {
          const list = divisionsByPart.get(row.part_id) ?? [];
          list.push(mapDivision(row));
          divisionsByPart.set(row.part_id, list);
        }
      }

      return parts.map(
        (row): PartWithDivisions => ({
          ...mapPart(row),
          divisions: sortDivisions(divisionsByPart.get(row.id) ?? []),
        }),
      );
    },

    async getById(organizationId, partId) {
      const { data: part, error } = await supabase
        .from('parts')
        .select(PART_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('id', partId)
        .maybeSingle();

      if (error || !part) {
        return null;
      }

      const { data: divisions } = await supabase
        .from('part_divisions')
        .select(DIVISION_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('part_id', partId)
        .order('name');

      return {
        ...mapPart(part),
        divisions: sortDivisions((divisions ?? []).map(mapDivision)),
      };
    },

    async create(organizationId, input: PartInput) {
      const { data, error } = await supabase
        .from('parts')
        .insert({
          organization_id: organizationId,
          name: input.name,
          kind: input.kind,
          sort_order: input.sortOrder ?? 0,
          default_transpose_semitones: input.defaultTransposeSemitones ?? 0,
        })
        .select(PART_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapPart(data);
    },

    async update(organizationId, partId, input: PartInput) {
      const payload: {
        name: string;
        kind: Part['kind'];
        sort_order?: number;
        default_transpose_semitones?: number;
      } = {
        name: input.name,
        kind: input.kind,
      };

      if (input.sortOrder !== undefined) {
        payload.sort_order = input.sortOrder;
      }
      if (input.defaultTransposeSemitones !== undefined) {
        payload.default_transpose_semitones = input.defaultTransposeSemitones;
      }

      const { data, error } = await supabase
        .from('parts')
        .update(payload)
        .eq('organization_id', organizationId)
        .eq('id', partId)
        .select(PART_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      return mapPart(data);
    },

    async addDivision(organizationId, partId, input: PartDivisionInput) {
      const { data, error } = await supabase
        .from('part_divisions')
        .insert({
          organization_id: organizationId,
          part_id: partId,
          name: input.name,
          sort_order: input.sortOrder ?? 0,
        })
        .select(DIVISION_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapDivision(data);
    },

    async updateDivision(organizationId, divisionId, input: PartDivisionInput) {
      const payload: {
        name: string;
        sort_order?: number;
      } = {
        name: input.name,
      };

      if (input.sortOrder !== undefined) {
        payload.sort_order = input.sortOrder;
      }

      const { data, error } = await supabase
        .from('part_divisions')
        .update(payload)
        .eq('organization_id', organizationId)
        .eq('id', divisionId)
        .select(DIVISION_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      return mapDivision(data);
    },

    async removeDivision(organizationId, divisionId) {
      const { error } = await supabase
        .from('part_divisions')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', divisionId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async reorderParts(organizationId, orderedPartIds) {
      const sortOrders = sortOrdersFromIds(orderedPartIds);

      const results = await Promise.all(
        [...sortOrders.entries()].map(([id, sortOrder]) =>
          supabase
            .from('parts')
            .update({ sort_order: sortOrder })
            .eq('organization_id', organizationId)
            .eq('id', id),
        ),
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error.message);
      }
    },

    async getRemovalImpact(organizationId, partId): Promise<PartRemovalImpact> {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('musician_id')
        .eq('organization_id', organizationId)
        .eq('part_id', partId);

      if (assignmentsError) {
        throw new Error(assignmentsError.message);
      }

      const musicianCount = new Set((assignments ?? []).map((row) => row.musician_id)).size;

      const { data: fileLinks, error: fileLinksError } = await supabase
        .from('piece_file_part_links')
        .select('piece_file_id')
        .eq('organization_id', organizationId)
        .eq('part_id', partId);

      if (fileLinksError) {
        throw new Error(fileLinksError.message);
      }

      const linkedFileCount = new Set((fileLinks ?? []).map((row) => row.piece_file_id)).size;

      return { musicianCount, linkedFileCount };
    },

    async remove(organizationId, partId) {
      const { error: clearAssignmentsError } = await supabase
        .from('assignments')
        .update({ part_id: null })
        .eq('organization_id', organizationId)
        .eq('part_id', partId);

      if (clearAssignmentsError) {
        throw new Error(clearAssignmentsError.message);
      }

      const { error: clearSectionPartsError } = await supabase
        .from('section_parts')
        .delete()
        .eq('organization_id', organizationId)
        .eq('part_id', partId);

      if (clearSectionPartsError) {
        throw new Error(clearSectionPartsError.message);
      }

      const { error: clearFileLinksError } = await supabase
        .from('piece_file_part_links')
        .delete()
        .eq('organization_id', organizationId)
        .eq('part_id', partId);

      if (clearFileLinksError) {
        throw new Error(clearFileLinksError.message);
      }

      const { error: deletePartError } = await supabase
        .from('parts')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', partId);

      if (deletePartError) {
        throw new Error(deletePartError.message);
      }
    },
  };
}
