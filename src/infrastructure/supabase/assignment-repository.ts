import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type {
  Assignment,
  AssignmentInput,
  AssignmentWithDetails,
  GroupAssignmentListItem,
} from '@/domain/ensemble';
import { supabase } from './client';

const ASSIGNMENT_COLUMNS =
  'id, organization_id, musician_id, group_id, section_id, part_id, ensemble_role';

function mapAssignment(row: {
  id: string;
  organization_id: string;
  musician_id: string;
  group_id: string;
  section_id: string | null;
  part_id: string | null;
  ensemble_role: Assignment['ensembleRole'];
}): Assignment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    musicianId: row.musician_id,
    groupId: row.group_id,
    sectionId: row.section_id,
    partId: row.part_id,
    ensembleRole: row.ensemble_role,
  };
}

export function createAssignmentRepository(): AssignmentRepository {
  return {
    async listForMusician(organizationId, musicianId) {
      const { data, error } = await supabase
        .from('assignments')
        .select(
          `${ASSIGNMENT_COLUMNS}, groups(name), sections(name), parts(name)`,
        )
        .eq('organization_id', organizationId)
        .eq('musician_id', musicianId)
        .order('created_at');

      if (error || !data) {
        return [];
      }

      return data.map(
        (row): AssignmentWithDetails => ({
          ...mapAssignment(
            row as {
              id: string;
              organization_id: string;
              musician_id: string;
              group_id: string;
              section_id: string | null;
              part_id: string | null;
              ensemble_role: Assignment['ensembleRole'];
            },
          ),
          groupName: (row.groups as unknown as { name: string } | null)?.name ?? '',
          sectionName: (row.sections as unknown as { name: string } | null)?.name ?? null,
          partName: (row.parts as unknown as { name: string } | null)?.name ?? null,
        }),
      );
    },

    async listForGroup(organizationId, groupId) {
      const { data, error } = await supabase
        .from('assignments')
        .select(
          `${ASSIGNMENT_COLUMNS}, musicians(full_name, phone), groups(name), sections(name), parts(name)`,
        )
        .eq('organization_id', organizationId)
        .eq('group_id', groupId)
        .order('created_at');

      if (error || !data) {
        return [];
      }

      const assignments = data.map((row): GroupAssignmentListItem => {
        const musician = row.musicians as unknown as {
          full_name: string;
          phone: string | null;
        } | null;
        return {
          ...mapAssignment(
            row as {
              id: string;
              organization_id: string;
              musician_id: string;
              group_id: string;
              section_id: string | null;
              part_id: string | null;
              ensemble_role: Assignment['ensembleRole'];
            },
          ),
          musicianName: musician?.full_name ?? '',
          musicianPhone: musician?.phone ?? null,
          groupName: (row.groups as unknown as { name: string } | null)?.name ?? '',
          sectionName: (row.sections as unknown as { name: string } | null)?.name ?? null,
          partName: (row.parts as unknown as { name: string } | null)?.name ?? null,
        };
      });

      return assignments.sort((left, right) =>
        left.musicianName.localeCompare(right.musicianName, 'pt-BR'),
      );
    },

    async listForGroups(organizationId, groupIds) {
      if (groupIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('assignments')
        .select('musician_id, group_id, musicians(full_name, user_id)')
        .eq('organization_id', organizationId)
        .in('group_id', groupIds);

      if (error || !data) {
        return [];
      }

      return data.map((row) => {
        const musician = row.musicians as unknown as {
          full_name: string;
          user_id: string | null;
        } | null;
        return {
          musicianId: row.musician_id,
          musicianName: musician?.full_name ?? '',
          musicianUserId: musician?.user_id ?? null,
          groupId: row.group_id,
        };
      });
    },

    async listPartNamesByMusicianIds(organizationId, musicianIds) {
      const byMusician = new Map<string, string[]>();
      if (musicianIds.length === 0) {
        return byMusician;
      }

      const { data, error } = await supabase
        .from('assignments')
        .select('musician_id, parts(name)')
        .eq('organization_id', organizationId)
        .in('musician_id', musicianIds);

      if (error || !data) {
        return byMusician;
      }

      const namesByMusician = new Map<string, Set<string>>();
      for (const row of data) {
        const part = row.parts as unknown as { name: string } | null;
        const partName = part?.name?.trim();
        if (!partName) {
          continue;
        }
        const names = namesByMusician.get(row.musician_id) ?? new Set<string>();
        names.add(partName);
        namesByMusician.set(row.musician_id, names);
      }

      for (const [musicianId, names] of namesByMusician) {
        byMusician.set(
          musicianId,
          [...names].sort((left, right) => left.localeCompare(right, 'pt-BR')),
        );
      }

      return byMusician;
    },

    async getById(organizationId, assignmentId) {
      const { data, error } = await supabase
        .from('assignments')
        .select(ASSIGNMENT_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('id', assignmentId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapAssignment(data);
    },

    async create(organizationId, musicianId, input: AssignmentInput) {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          organization_id: organizationId,
          musician_id: musicianId,
          group_id: input.groupId,
          section_id: input.sectionId ?? null,
          part_id: input.partId ?? null,
          ensemble_role: input.ensembleRole,
        })
        .select(ASSIGNMENT_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'create_failed');
      }

      return mapAssignment(data);
    },

    async update(organizationId, assignmentId, input: AssignmentInput) {
      const { data, error } = await supabase
        .from('assignments')
        .update({
          group_id: input.groupId,
          section_id: input.sectionId ?? null,
          part_id: input.partId ?? null,
          ensemble_role: input.ensembleRole,
        })
        .eq('organization_id', organizationId)
        .eq('id', assignmentId)
        .select(ASSIGNMENT_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      return mapAssignment(data);
    },

    async remove(organizationId, assignmentId) {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', assignmentId);

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}
