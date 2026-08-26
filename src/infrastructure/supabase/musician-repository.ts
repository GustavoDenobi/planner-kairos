import type {
  ListMusiciansOptions,
  MusicianRepository,
} from '@/application/ports/musician-repository';
import type { EnsembleRole, Musician, MusicianInput, MusicianListItem, MusicianAssignmentSummary } from '@/domain/ensemble';
import { normalizePhone } from '@/domain/ensemble';
import { supabase } from './client';

const MUSICIAN_COLUMNS =
  'id, organization_id, full_name, birth_date, phone, email, user_id, notes, created_at';

const DEFAULT_PAGE_SIZE = 30;

function sanitizeIlikePattern(value: string): string {
  return value.replace(/[%_]/g, '');
}

function mapMusician(row: {
  id: string;
  organization_id: string;
  full_name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  user_id: string | null;
  notes: string | null;
  created_at: string;
}): Musician {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fullName: row.full_name,
    birthDate: row.birth_date,
    phone: row.phone,
    email: row.email,
    userId: row.user_id,
    notes: row.notes,
  };
}

async function loadAssignmentSummaries(
  organizationId: string,
  musicianIds: string[],
): Promise<Map<string, MusicianAssignmentSummary[]>> {
  const byMusician = new Map<string, MusicianAssignmentSummary[]>();

  if (musicianIds.length === 0) {
    return byMusician;
  }

  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('musician_id, group_id, ensemble_role, groups(name), sections(name), parts(name)')
    .eq('organization_id', organizationId)
    .in('musician_id', musicianIds)
    .order('created_at');

  if (error || !assignments) {
    return byMusician;
  }

  for (const row of assignments) {
    const musicianId = row.musician_id as string;
    const current = byMusician.get(musicianId) ?? [];
    current.push({
      groupId: row.group_id as string,
      groupName: (row.groups as unknown as { name: string } | null)?.name ?? '',
      ensembleRole: row.ensemble_role as EnsembleRole,
      sectionName: (row.sections as unknown as { name: string } | null)?.name ?? null,
      partName: (row.parts as unknown as { name: string } | null)?.name ?? null,
    });
    byMusician.set(musicianId, current);
  }

  return byMusician;
}

async function findMusicianIdsMatchingAssignmentFilters(
  organizationId: string,
  filters: {
    groupId?: string;
    sectionId?: string;
    partId?: string;
    ensembleRole?: EnsembleRole;
  },
): Promise<string[] | null> {
  const hasFilter = Boolean(
    filters.groupId || filters.sectionId || filters.partId || filters.ensembleRole,
  );
  if (!hasFilter) {
    return null;
  }

  let assignmentsQuery = supabase
    .from('assignments')
    .select('musician_id')
    .eq('organization_id', organizationId);

  if (filters.groupId) {
    assignmentsQuery = assignmentsQuery.eq('group_id', filters.groupId);
  }
  if (filters.sectionId) {
    assignmentsQuery = assignmentsQuery.eq('section_id', filters.sectionId);
  }
  if (filters.partId) {
    assignmentsQuery = assignmentsQuery.eq('part_id', filters.partId);
  }
  if (filters.ensembleRole) {
    assignmentsQuery = assignmentsQuery.eq('ensemble_role', filters.ensembleRole);
  }

  const { data, error } = await assignmentsQuery;
  if (error || !data) {
    return [];
  }

  return [...new Set(data.map((row) => row.musician_id))];
}

function mapMusicianListItems(
  rows: Array<{
    id: string;
    organization_id: string;
    full_name: string;
    birth_date: string | null;
    phone: string | null;
    email: string | null;
    user_id: string | null;
    notes: string | null;
    created_at: string;
  }>,
  statsByMusician: Map<string, MusicianAssignmentSummary[]>,
): MusicianListItem[] {
  return rows.map((row): MusicianListItem => {
    const assignments = statsByMusician.get(row.id) ?? [];
    return {
      ...mapMusician(row),
      createdAt: row.created_at,
      assignmentCount: assignments.length,
      groupNames: [...new Set(assignments.map((assignment) => assignment.groupName).filter(Boolean))].sort(),
      assignments,
    };
  });
}

export function createMusicianRepository(): MusicianRepository {
  return {
    async listForOrg(organizationId, options: ListMusiciansOptions = {}) {
      const {
        query = '',
        sortBy = 'created_at',
        sortDirection = 'desc',
        groupId,
        sectionId,
        partId,
        ensembleRole,
        limit = DEFAULT_PAGE_SIZE,
        offset = 0,
      } = options;

      const assignmentMusicianIds = await findMusicianIdsMatchingAssignmentFilters(
        organizationId,
        { groupId, sectionId, partId, ensembleRole },
      );
      if (assignmentMusicianIds && assignmentMusicianIds.length === 0) {
        return { items: [], totalCount: 0, hasMore: false };
      }

      let musiciansQuery = supabase
        .from('musicians')
        .select(MUSICIAN_COLUMNS, { count: 'exact' })
        .eq('organization_id', organizationId);

      if (assignmentMusicianIds) {
        musiciansQuery = musiciansQuery.in('id', assignmentMusicianIds);
      }

      const trimmedQuery = query.trim();
      if (trimmedQuery) {
        const safePattern = sanitizeIlikePattern(trimmedQuery);
        const phoneDigits = normalizePhone(trimmedQuery);

        if (phoneDigits.length >= 3) {
          musiciansQuery = musiciansQuery.or(
            `full_name.ilike.%${safePattern}%,phone.ilike.%${phoneDigits}%`,
          );
        } else {
          musiciansQuery = musiciansQuery.ilike('full_name', `%${safePattern}%`);
        }
      }

      const sortColumn = sortBy === 'created_at' ? 'created_at' : 'full_name';
      musiciansQuery = musiciansQuery
        .order(sortColumn, { ascending: sortDirection === 'asc' })
        .range(offset, offset + limit - 1);

      const { data: musicians, error, count } = await musiciansQuery;

      if (error || !musicians) {
        return { items: [], totalCount: 0, hasMore: false };
      }

      const totalCount = count ?? musicians.length;
      const assignmentsByMusician = await loadAssignmentSummaries(
        organizationId,
        musicians.map((row) => row.id),
      );

      return {
        items: mapMusicianListItems(musicians, assignmentsByMusician),
        totalCount,
        hasMore: offset + musicians.length < totalCount,
      };
    },

    async listBirthdaysForOrg(organizationId, options = {}) {
      const assignmentMusicianIds = await findMusicianIdsMatchingAssignmentFilters(
        organizationId,
        { groupId: options.groupId },
      );
      if (assignmentMusicianIds && assignmentMusicianIds.length === 0) {
        return [];
      }

      let query = supabase
        .from('musicians')
        .select('id, full_name, birth_date')
        .eq('organization_id', organizationId)
        .not('birth_date', 'is', null)
        .order('full_name');

      if (assignmentMusicianIds) {
        query = query.in('id', assignmentMusicianIds);
      }

      const { data, error } = await query;

      if (error || !data) {
        return [];
      }

      const musicianIds = data.map((row) => row.id);
      const assignmentsByMusician = await loadAssignmentSummaries(organizationId, musicianIds);

      return data
        .filter((row) => row.birth_date)
        .map((row) => ({
          id: row.id,
          fullName: row.full_name,
          birthDate: row.birth_date as string,
          assignments: assignmentsByMusician.get(row.id) ?? [],
        }));
    },

    async listNamesForOrg(organizationId) {
      const { data, error } = await supabase
        .from('musicians')
        .select('id, full_name, user_id')
        .eq('organization_id', organizationId)
        .order('full_name');

      if (error || !data) {
        return [];
      }

      return data.map((row) => ({
        id: row.id,
        fullName: row.full_name,
        userId: row.user_id,
      }));
    },

    async getById(organizationId, musicianId) {
      const { data, error } = await supabase
        .from('musicians')
        .select(MUSICIAN_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('id', musicianId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapMusician(data);
    },

    async getByUserId(organizationId, userId) {
      const { data, error } = await supabase
        .from('musicians')
        .select(MUSICIAN_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return mapMusician(data);
    },

    async create(organizationId, input: MusicianInput) {
      const { data, error } = await supabase.rpc('create_musician', {
        p_organization_id: organizationId,
        p_full_name: input.fullName,
        p_phone: input.phone ?? null,
        p_email: input.email ?? null,
        p_birth_date: input.birthDate ?? null,
        p_notes: null,
      });

      if (error || !data || data.length === 0) {
        throw new Error(error?.message ?? 'create_failed');
      }

      const musician = await this.getById(organizationId, data[0].musician_id);
      if (!musician) {
        throw new Error('create_failed');
      }

      return musician;
    },

    async update(organizationId, musicianId, input: MusicianInput) {
      const { data, error } = await supabase
        .from('musicians')
        .update({
          full_name: input.fullName,
          birth_date: input.birthDate ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
        })
        .eq('organization_id', organizationId)
        .eq('id', musicianId)
        .select(MUSICIAN_COLUMNS)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'update_failed');
      }

      return mapMusician(data);
    },

    async merge(organizationId, sourceId, targetId) {
      const source = await this.getById(organizationId, sourceId);
      const target = await this.getById(organizationId, targetId);
      if (!source || !target) {
        throw new Error('not_found');
      }

      const { error } = await supabase.rpc('merge_musicians', {
        p_source_id: sourceId,
        p_target_id: targetId,
      });

      if (error) {
        throw new Error(error.message);
      }
    },

    async delete(organizationId, musicianId) {
      const { error } = await supabase
        .from('musicians')
        .delete()
        .eq('organization_id', organizationId)
        .eq('id', musicianId);

      if (error) {
        throw new Error(error.message);
      }
    },
  };
}

