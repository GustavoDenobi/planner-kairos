import { describe, expect, it } from 'vitest';
import type { OfflineMusicianCache } from '@/application/ports/offline-musician-cache';
import type { AssignmentWithDetails, MusicianListItem } from '@/domain/ensemble';
import {
  getCachedMusician,
  listCachedAssignmentsForMusician,
  listCachedMusicians,
} from '@/application/offline/musician-cache-use-cases';

function createMusicianCache(
  initial: ReturnType<typeof buildSnapshot> | null = null,
): OfflineMusicianCache {
  let snapshot = initial;

  return {
    get: async (organizationId, userId) => {
      if (!snapshot || snapshot.organizationId !== organizationId || snapshot.userId !== userId) {
        return null;
      }
      return snapshot;
    },
    put: async (value) => {
      snapshot = value;
    },
    remove: async () => {
      snapshot = null;
    },
    clearAll: async () => {
      snapshot = null;
    },
  };
}

function sampleMusician(overrides: Partial<MusicianListItem> = {}): MusicianListItem {
  return {
    id: 'musician-1',
    organizationId: 'org-1',
    fullName: 'Ana Silva',
    birthDate: null,
    phone: '11999998888',
    email: 'ana@example.com',
    userId: null,
    notes: null,
    createdAt: '2026-01-10T12:00:00.000Z',
    assignmentCount: 1,
    groupNames: ['Orquestra'],
    ...overrides,
  };
}

function sampleAssignment(
  overrides: Partial<AssignmentWithDetails> = {},
): AssignmentWithDetails {
  return {
    id: 'assignment-1',
    organizationId: 'org-1',
    musicianId: 'musician-1',
    groupId: 'group-1',
    sectionId: 'section-1',
    partId: 'part-1',
    ensembleRole: 'member',
    groupName: 'Orquestra',
    sectionName: 'Violinos',
    partName: 'Primeiro',
    ...overrides,
  };
}

function buildSnapshot(params: {
  organizationId?: string;
  userId?: string;
  musicians?: MusicianListItem[];
  assignmentsByMusician?: Record<string, AssignmentWithDetails[]>;
}) {
  const musicians = params.musicians ?? [sampleMusician()];
  const assignmentsByMusician = params.assignmentsByMusician ?? {
    'musician-1': [sampleAssignment()],
  };

  return {
    organizationId: params.organizationId ?? 'org-1',
    userId: params.userId ?? 'user-1',
    cachedAt: '2026-08-20T12:00:00.000Z',
    musiciansJson: JSON.stringify(musicians),
    assignmentsJson: JSON.stringify(assignmentsByMusician),
    groupsJson: JSON.stringify([]),
    partsJson: JSON.stringify([]),
    sectionsJson: JSON.stringify([]),
  };
}

describe('musician-cache-use-cases', () => {
  it('returns empty list when no cache exists', async () => {
    const cache = createMusicianCache(null);

    const result = await listCachedMusicians(cache, 'org-1', 'user-1');

    expect(result.items).toEqual([]);
    expect(result.cachedAt).toBeNull();
  });

  it('filters musicians by search query', async () => {
    const cache = createMusicianCache(
      buildSnapshot({
        musicians: [
          sampleMusician({ id: 'musician-1', fullName: 'Ana Silva' }),
          sampleMusician({ id: 'musician-2', fullName: 'Bruno Costa' }),
        ],
        assignmentsByMusician: {
          'musician-1': [],
          'musician-2': [],
        },
      }),
    );

    const result = await listCachedMusicians(cache, 'org-1', 'user-1', {
      query: 'bruno',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.fullName).toBe('Bruno Costa');
    expect(result.cachedAt).toBe('2026-08-20T12:00:00.000Z');
  });

  it('filters musicians by assignment group', async () => {
    const cache = createMusicianCache(
      buildSnapshot({
        musicians: [
          sampleMusician({ id: 'musician-1', fullName: 'Ana Silva' }),
          sampleMusician({ id: 'musician-2', fullName: 'Bruno Costa' }),
        ],
        assignmentsByMusician: {
          'musician-1': [sampleAssignment({ groupId: 'group-1' })],
          'musician-2': [sampleAssignment({ groupId: 'group-2', id: 'assignment-2' })],
        },
      }),
    );

    const result = await listCachedMusicians(cache, 'org-1', 'user-1', {
      groupId: 'group-2',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('musician-2');
  });

  it('returns cached musician and assignments', async () => {
    const cache = createMusicianCache(buildSnapshot({}));

    const musician = await getCachedMusician(cache, 'org-1', 'user-1', 'musician-1');
    const assignments = await listCachedAssignmentsForMusician(
      cache,
      'org-1',
      'user-1',
      'musician-1',
    );

    expect(musician?.fullName).toBe('Ana Silva');
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.groupName).toBe('Orquestra');
  });
});
