import { describe, expect, it, vi } from 'vitest';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { EventRecurrenceRepository } from '@/application/ports/event-recurrence-repository';
import type { EventRepository } from '@/application/ports/event-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import { cancelRecurrence, scheduleRecurrence } from '@/application/agenda/recurrence-use-cases';
import type { EventDetail, EventRecurrence } from '@/domain/agenda';

function recurrenceDetail(): EventRecurrence {
  return {
    id: 'rec-1',
    organizationId: 'org-1',
    typeId: 'type-1',
    title: null,
    location: null,
    notes: null,
    durationMinutes: null,
    seriesStartsAt: '2026-08-18T10:00:00.000Z',
    seriesEndsAt: '2026-09-30T23:59:59.999Z',
    rule: { frequency: 'weekly', interval: 1, byWeekday: [2] },
    limitAnchorAt: '2026-08-01T00:00:00.000Z',
    cancelledAt: null,
    createdBy: 'user-teacher',
    groupIds: ['class-1'],
    musicianIds: [],
  };
}

function eventDetail(): EventDetail {
  return {
    id: 'event-1',
    organizationId: 'org-1',
    typeId: 'type-1',
    title: null,
    startsAt: '2026-08-18T10:00:00.000Z',
    endsAt: null,
    location: null,
    notes: null,
    createdBy: 'user-teacher',
    recurrenceId: 'rec-1',
    occurrenceIndex: 0,
    originalStartsAt: '2026-08-18T10:00:00.000Z',
    isException: false,
    type: {
      id: 'type-1',
      organizationId: 'org-1',
      name: 'Ensaio',
      kind: 'rehearsal',
      sortOrder: 1,
      color: null,
    },
    program: [],
    groups: [{ id: 'class-1', name: 'Turma', kind: 'class' }],
    musicians: [],
  };
}

function createRepos() {
  const membershipRepo: MembershipRepository = {
    getByUserAndOrg: async () => ({
      id: 'mem-1',
      organizationId: 'org-1',
      userId: 'user-teacher',
      accessRole: 'admin' as const,
    }),
    grantAdmin: vi.fn(),
    revokeAdmin: vi.fn(),
  };

  const musicianRepo: MusicianRepository = {
    listForOrg: async () => ({ items: [], totalCount: 0, hasMore: false }),
    listBirthdaysForOrg: async () => [],
    listNamesForOrg: async () => [],
    getById: async () => null,
    getByUserId: async () => null,
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    merge: vi.fn(),
  };

  const assignmentRepo: AssignmentRepository = {
    listForMusician: async () => [],
    listForGroups: async () => [],
    listForGroup: async () => [],
    listPartNamesByMusicianIds: async () => new Map(),
    getById: async () => null,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const eventRepo: EventRepository = {
    listInRange: vi.fn(),
    getById: vi.fn(async () => eventDetail()),
    create: vi.fn(),
    update: vi.fn(),
    replaceProgram: vi.fn(),
    delete: vi.fn(),
    markAsException: vi.fn(),
    bulkUpdateFutureOccurrences: vi.fn(),
    replaceAudienceForFutureOccurrences: vi.fn(),
  };

  const recurrenceRepo: EventRecurrenceRepository = {
    createWithOccurrences: vi.fn(async () => ({
      recurrence: recurrenceDetail(),
      firstEventId: 'event-1',
    })),
    getById: vi.fn(async () => recurrenceDetail()),
    cancel: vi.fn(),
    updateTemplate: vi.fn(),
    replaceAudience: vi.fn(),
    deleteOccurrencesFromIndex: vi.fn(),
    deleteOccurrencesAfterDate: vi.fn(),
    listOccurrenceSummaries: vi.fn(async () => []),
    truncateSeriesEnd: vi.fn(),
  };

  return { membershipRepo, musicianRepo, assignmentRepo, eventRepo, recurrenceRepo };
}

describe('recurrence-use-cases', () => {
  it('scheduleRecurrence creates series and returns first event', async () => {
    const repos = createRepos();
    const result = await scheduleRecurrence(
      repos.eventRepo,
      repos.recurrenceRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-teacher',
      {
        typeId: 'type-1',
        startsAt: '2026-08-18T10:00:00.000Z',
        seriesEndsAt: '2026-09-30',
        rule: { frequency: 'weekly', interval: 1, byWeekday: [2] },
        groupIds: ['class-1'],
      },
    );

    expect(result.ok).toBe(true);
    expect(repos.recurrenceRepo.createWithOccurrences).toHaveBeenCalled();
  });

  it('cancelRecurrence deletes only from provided instant', async () => {
    const repos = createRepos();
    const result = await cancelRecurrence(
      repos.recurrenceRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-teacher',
      'rec-1',
      '2026-09-01T00:00:00.000Z',
    );

    expect(result.ok).toBe(true);
    expect(repos.recurrenceRepo.cancel).toHaveBeenCalledWith(
      'org-1',
      'rec-1',
      '2026-09-01T00:00:00.000Z',
    );
  });
});
