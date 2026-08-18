import type {
  ListMusiciansOptions,
  MusicianRepository,
} from '@/application/ports/musician-repository';
import type { Musician, MusicianInput, MusicianListItem } from '@/domain/ensemble';
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

async function loadAssignmentStats(
  organizationId: string,
  musicianIds: string[],
): Promise<Map<string, { count: number; groups: Set<string> }>> {
  const byMusician = new Map<string, { count: number; groups: Set<string> }>();

  if (musicianIds.length === 0) {
    return byMusician;
  }

  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('musician_id, groups(name)')
    .eq('organization_id', organizationId)
    .in('musician_id', musicianIds);

  if (error || !assignments) {
    return byMusician;
  }

  for (const row of assignments) {
    const musicianId = row.musician_id as string;
    const groupName = (row.groups as { name: string } | null)?.name;
    const entry = byMusician.get(musicianId) ?? { count: 0, groups: new Set<string>() };
    entry.count += 1;
    if (groupName) {
      entry.groups.add(groupName);
    }
    byMusician.set(musicianId, entry);
  }

  return byMusician;
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
  statsByMusician: Map<string, { count: number; groups: Set<string> }>,
): MusicianListItem[] {
  return rows.map((row): MusicianListItem => {
    const stats = statsByMusician.get(row.id);
    return {
      ...mapMusician(row),
      createdAt: row.created_at,
      assignmentCount: stats?.count ?? 0,
      groupNames: stats ? [...stats.groups].sort() : [],
    };
  });
}

export function createMusicianRepository(): MusicianRepository {
  return {
    async listForOrg(organizationId, options: ListMusiciansOptions = {}) {
      const {
        query = '',
        sortBy = 'name',
        sortDirection = 'asc',
        limit = DEFAULT_PAGE_SIZE,
        offset = 0,
      } = options;

      let musiciansQuery = supabase
        .from('musicians')
        .select(MUSICIAN_COLUMNS, { count: 'exact' })
        .eq('organization_id', organizationId);

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
      const statsByMusician = await loadAssignmentStats(
        organizationId,
        musicians.map((row) => row.id),
      );

      return {
        items: mapMusicianListItems(musicians, statsByMusician),
        totalCount,
        hasMore: offset + musicians.length < totalCount,
      };
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
