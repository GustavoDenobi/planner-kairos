import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type {
  Assignment,
  AssignmentInput,
  AssignmentWithDetails,
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
          groupName: (row.groups as { name: string } | null)?.name ?? '',
          sectionName: (row.sections as { name: string } | null)?.name ?? null,
          partName: (row.parts as { name: string } | null)?.name ?? null,
        }),
      );
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
