import type {
  ListMusiciansOptions,
  MusicianRepository,
} from '@/application/ports/musician-repository';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { GroupRepository } from '@/application/ports/group-repository';
import type { PartRepository } from '@/application/ports/part-repository';
import type { SectionRepository } from '@/application/ports/section-repository';
import type { OfflineMusicianCache } from '@/application/ports/offline-musician-cache';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import type {
  AssignmentWithDetails,
  GroupListItem,
  Musician,
  MusicianListItem,
  SectionListItem,
} from '@/domain/ensemble';
import { normalizePhone } from '@/domain/ensemble';
import { Result } from '@/domain/shared';
import { listAssignmentsForMusician } from '@/application/ensemble/assignment-use-cases';
import { listGroups } from '@/application/ensemble/list-groups';
import { listMusicians } from '@/application/ensemble/musician-use-cases';
import { listParts } from '@/application/ensemble/part-use-cases';
import { listSections } from '@/application/ensemble/section-use-cases';
import { isBrowserOnline } from './file-cache-use-cases';

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

const CACHE_PAGE_SIZE = 100;

export type CachedMusiciansListResult = {
  items: MusicianListItem[];
  totalCount: number;
  hasMore: boolean;
  cachedAt: string | null;
};

export type CachedMusiciansFilterData = {
  groups: GroupListItem[];
  parts: PartWithDivisions[];
  sections: SectionListItem[];
};

type ParsedSnapshot = {
  musicians: MusicianListItem[];
  assignmentsByMusician: Record<string, AssignmentWithDetails[]>;
  groups: GroupListItem[];
  parts: PartWithDivisions[];
  sections: SectionListItem[];
  cachedAt: string;
};

function parseSnapshot(snapshot: {
  musiciansJson: string;
  assignmentsJson: string;
  groupsJson: string;
  partsJson: string;
  sectionsJson: string;
  cachedAt: string;
}): ParsedSnapshot {
  return {
    musicians: JSON.parse(snapshot.musiciansJson) as MusicianListItem[],
    assignmentsByMusician: JSON.parse(snapshot.assignmentsJson) as Record<
      string,
      AssignmentWithDetails[]
    >,
    groups: JSON.parse(snapshot.groupsJson) as GroupListItem[],
    parts: JSON.parse(snapshot.partsJson) as PartWithDivisions[],
    sections: JSON.parse(snapshot.sectionsJson) as SectionListItem[],
    cachedAt: snapshot.cachedAt,
  };
}

function matchesAssignmentFilters(
  assignments: AssignmentWithDetails[],
  options: ListMusiciansOptions,
): boolean {
  const { groupId, sectionId, partId, ensembleRole } = options;
  if (!groupId && !sectionId && !partId && !ensembleRole) {
    return true;
  }

  return assignments.some((assignment) => {
    if (groupId && assignment.groupId !== groupId) {
      return false;
    }
    if (sectionId && assignment.sectionId !== sectionId) {
      return false;
    }
    if (partId && assignment.partId !== partId) {
      return false;
    }
    if (ensembleRole && assignment.ensembleRole !== ensembleRole) {
      return false;
    }
    return true;
  });
}

function matchesSearchQuery(musician: MusicianListItem, query: string): boolean {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return true;
  }

  const normalizedQuery = normalizeSearchText(trimmedQuery);
  const phoneDigits = normalizePhone(trimmedQuery);

  if (phoneDigits.length >= 3 && musician.phone?.includes(phoneDigits)) {
    return true;
  }

  return normalizeSearchText(musician.fullName).includes(normalizedQuery);
}

function sortMusicians(
  musicians: MusicianListItem[],
  options: ListMusiciansOptions,
): MusicianListItem[] {
  const sortBy = options.sortBy ?? 'created_at';
  const sortDirection = options.sortDirection ?? 'desc';

  return [...musicians].sort((a, b) => {
    const comparison =
      sortBy === 'created_at'
        ? a.createdAt.localeCompare(b.createdAt)
        : a.fullName.localeCompare(b.fullName, 'pt-BR');
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

function filterCachedMusicians(
  musicians: MusicianListItem[],
  assignmentsByMusician: Record<string, AssignmentWithDetails[]>,
  options: ListMusiciansOptions,
): MusicianListItem[] {
  const filtered = musicians.filter((musician) => {
    const assignments = assignmentsByMusician[musician.id] ?? [];
    return (
      matchesAssignmentFilters(assignments, options) &&
      matchesSearchQuery(musician, options.query ?? '')
    );
  });

  return sortMusicians(filtered, options);
}

async function fetchAllMusicians(
  musicianRepo: MusicianRepository,
  organizationId: string,
): Promise<MusicianListItem[]> {
  const allMusicians: MusicianListItem[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const pageResult = await listMusicians(musicianRepo, organizationId, {
      limit: CACHE_PAGE_SIZE,
      offset,
    });

    if (!pageResult.ok) {
      break;
    }

    allMusicians.push(...pageResult.value.items);
    hasMore = pageResult.value.hasMore;
    offset += CACHE_PAGE_SIZE;
  }

  return allMusicians;
}

export async function cacheMusiciansForOffline(
  musicianRepo: MusicianRepository,
  assignmentRepo: AssignmentRepository,
  groupRepo: GroupRepository,
  partRepo: PartRepository,
  sectionRepo: SectionRepository,
  musicianCache: OfflineMusicianCache,
  organizationId: string,
  userId: string,
): Promise<Result<void, string>> {
  if (!isBrowserOnline()) {
    return Result.fail('offline');
  }

  const [allMusicians, groupsResult, partsResult] = await Promise.all([
    fetchAllMusicians(musicianRepo, organizationId),
    listGroups(groupRepo, organizationId),
    listParts(partRepo, organizationId),
  ]);

  if (!groupsResult.ok || !partsResult.ok) {
    return Result.fail('metadata_failed');
  }

  const groups = groupsResult.value;
  const sectionResults = await Promise.all(
    groups.map((group) => listSections(sectionRepo, organizationId, group.id)),
  );
  const sections = sectionResults.flatMap((result) => (result.ok ? result.value : []));

  const assignmentsByMusician: Record<string, AssignmentWithDetails[]> = {};
  await Promise.all(
    allMusicians.map(async (musician) => {
      const result = await listAssignmentsForMusician(
        assignmentRepo,
        organizationId,
        musician.id,
      );
      assignmentsByMusician[musician.id] = result.ok ? result.value : [];
    }),
  );

  await musicianCache.put({
    organizationId,
    userId,
    cachedAt: new Date().toISOString(),
    musiciansJson: JSON.stringify(allMusicians),
    assignmentsJson: JSON.stringify(assignmentsByMusician),
    groupsJson: JSON.stringify(groups),
    partsJson: JSON.stringify(partsResult.value),
    sectionsJson: JSON.stringify(sections),
  });

  return Result.ok(undefined);
}

export async function listCachedMusicians(
  musicianCache: OfflineMusicianCache,
  organizationId: string,
  userId: string,
  options: ListMusiciansOptions = {},
): Promise<CachedMusiciansListResult> {
  const snapshot = await musicianCache.get(organizationId, userId);
  if (!snapshot) {
    return { items: [], totalCount: 0, hasMore: false, cachedAt: null };
  }

  const parsed = parseSnapshot(snapshot);
  const filtered = filterCachedMusicians(
    parsed.musicians,
    parsed.assignmentsByMusician,
    options,
  );

  const offset = options.offset ?? 0;
  const limit = options.limit ?? 30;
  const items = filtered.slice(offset, offset + limit);

  return {
    items,
    totalCount: filtered.length,
    hasMore: offset + items.length < filtered.length,
    cachedAt: parsed.cachedAt,
  };
}

export async function getCachedMusician(
  musicianCache: OfflineMusicianCache,
  organizationId: string,
  userId: string,
  musicianId: string,
): Promise<Musician | null> {
  const snapshot = await musicianCache.get(organizationId, userId);
  if (!snapshot) {
    return null;
  }

  const parsed = parseSnapshot(snapshot);
  const listItem = parsed.musicians.find((musician) => musician.id === musicianId);
  if (!listItem) {
    return null;
  }

  const { createdAt: _createdAt, assignmentCount: _count, groupNames: _groups, ...musician } =
    listItem;
  return musician;
}

export async function listCachedAssignmentsForMusician(
  musicianCache: OfflineMusicianCache,
  organizationId: string,
  userId: string,
  musicianId: string,
): Promise<AssignmentWithDetails[]> {
  const snapshot = await musicianCache.get(organizationId, userId);
  if (!snapshot) {
    return [];
  }

  const parsed = parseSnapshot(snapshot);
  return parsed.assignmentsByMusician[musicianId] ?? [];
}

export async function getCachedMusiciansFilterData(
  musicianCache: OfflineMusicianCache,
  organizationId: string,
  userId: string,
): Promise<(CachedMusiciansFilterData & { cachedAt: string }) | null> {
  const snapshot = await musicianCache.get(organizationId, userId);
  if (!snapshot) {
    return null;
  }

  const parsed = parseSnapshot(snapshot);
  return {
    groups: parsed.groups,
    parts: parsed.parts,
    sections: parsed.sections,
    cachedAt: parsed.cachedAt,
  };
}

export async function getCachedMusiciansMeta(
  musicianCache: OfflineMusicianCache,
  organizationId: string,
  userId: string,
): Promise<{ cachedAt: string } | null> {
  const snapshot = await musicianCache.get(organizationId, userId);
  if (!snapshot) {
    return null;
  }

  return { cachedAt: snapshot.cachedAt };
}
