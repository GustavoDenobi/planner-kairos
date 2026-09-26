import { describe, expect, it, vi } from 'vitest';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { EventRecurrenceRepository } from '@/application/ports/event-recurrence-repository';
import type { EventRepository } from '@/application/ports/event-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import { cancelRecurrence, scheduleRecurrence, updateRecurrenceOccurrence } from '@/application/agenda/recurrence-use-cases';
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
    cancelledAt: null,
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
    listGroupingRowsForGroups: async () => [],
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
    setCancelledAt: vi.fn(),
    bulkCancelFutureOccurrences: vi.fn(),
    bulkCancelOccurrencesFromInstant: vi.fn(),
    markAsException: vi.fn(),
    bulkUpdateFutureOccurrences: vi.fn(),
    replaceAudienceForFutureOccurrences: vi.fn(),
    getOccurrenceByIndex: vi.fn(async () => null),
  };

  const orgRepo: OrganizationRepository = {
    isPlatformAdmin: async () => false,
    listForUser: vi.fn(),
    listAllForPlatformAdmin: vi.fn(),
    getBySlug: vi.fn(),
    getById: vi.fn(),
    updateImageKey: vi.fn(),
    clearImage: vi.fn(),
    updateName: vi.fn(),
    updateRules: vi.fn(),
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
    deleteNonExceptionOccurrencesFromInstant: vi.fn(),
    insertOccurrences: vi.fn(),
  };

  return { membershipRepo, musicianRepo, assignmentRepo, eventRepo, orgRepo, recurrenceRepo };
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
      repos.orgRepo,
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
      repos.orgRepo,
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

  it('rejects all_future when the schedule changed', async () => {
    const repos = createRepos();
    const result = await updateRecurrenceOccurrence(
      repos.eventRepo,
      repos.recurrenceRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      repos.orgRepo,
      'org-1',
      'user-teacher',
      'event-1',
      'all_future',
      {
        typeId: 'type-1',
        startsAt: '2026-08-25T10:00:00.000Z',
        groupIds: ['class-1'],
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('recurrence_schedule_scope');
    }
    expect(repos.recurrenceRepo.updateTemplate).not.toHaveBeenCalled();
    expect(repos.eventRepo.bulkUpdateFutureOccurrences).not.toHaveBeenCalled();
  });

  it('following rebuilds the series on the new weekday', async () => {
    const repos = createRepos();
    const result = await updateRecurrenceOccurrence(
      repos.eventRepo,
      repos.recurrenceRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      repos.orgRepo,
      'org-1',
      'user-teacher',
      'event-1',
      'following',
      {
        typeId: 'type-1',
        startsAt: '2026-08-26T10:00:00.000Z',
        groupIds: ['class-1'],
      },
    );

    expect(result.ok).toBe(true);
    expect(repos.recurrenceRepo.createWithOccurrences).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        input: expect.objectContaining({
          rule: { frequency: 'weekly', interval: 1, byWeekday: [3] },
          startsAt: '2026-08-26T10:00:00.000Z',
        }),
        occurrences: expect.arrayContaining([
          expect.objectContaining({ startsAt: '2026-08-26T10:00:00.000Z' }),
        ]),
      }),
    );
  });

  it('following does not split when the new weekday is outside a multi-day rule', async () => {
    const repos = createRepos();
    vi.mocked(repos.recurrenceRepo.getById).mockResolvedValue({
      ...recurrenceDetail(),
      rule: { frequency: 'weekly', interval: 2, byWeekday: [2, 4] },
    });

    const result = await updateRecurrenceOccurrence(
      repos.eventRepo,
      repos.recurrenceRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      repos.orgRepo,
      'org-1',
      'user-teacher',
      'event-1',
      'following',
      {
        typeId: 'type-1',
        startsAt: '2026-08-26T10:00:00.000Z',
        groupIds: ['class-1'],
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('recurrence_schedule_weekday');
    }
    expect(repos.recurrenceRepo.deleteOccurrencesFromIndex).not.toHaveBeenCalled();
    expect(repos.recurrenceRepo.cancel).not.toHaveBeenCalled();
  });
});
