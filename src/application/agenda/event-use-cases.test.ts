import { describe, expect, it, vi } from 'vitest';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { EventRepository } from '@/application/ports/event-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import { scheduleEvent, updateEvent } from '@/application/agenda/event-use-cases';
import type { EventDetail } from '@/domain/agenda';
import type { EnsembleRole } from '@/domain/ensemble';

function eventDetail(overrides: Partial<EventDetail> = {}): EventDetail {
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
    type: {
      id: 'type-1',
      organizationId: 'org-1',
      name: 'Aula',
      kind: 'class',
      sortOrder: 1,
      color: null,
    },
    program: [],
    groups: [],
    musicians: [],
    ...overrides,
  };
}

function createRepos(options?: {
  role?: 'owner' | 'admin' | 'member';
  assignments?: Array<{ groupId: string; ensembleRole: EnsembleRole }>;
  musicianId?: string | null;
  students?: Array<{ musicianId: string; groupId: string }>;
  existing?: EventDetail | null;
}) {
  const role = options?.role ?? 'member';
  const assignments = options?.assignments ?? [
    { groupId: 'class-1', ensembleRole: 'teacher' as const },
  ];
  const musicianId = options?.musicianId === undefined ? 'teacher-1' : options.musicianId;
  const created: EventDetail[] = [];

  const membershipRepo: MembershipRepository = {
    getByUserAndOrg: async () =>
      role
        ? { id: 'mem-1', organizationId: 'org-1', userId: 'user-1', accessRole: role }
        : null,
    grantAdmin: vi.fn(),
    revokeAdmin: vi.fn(),
  };

  const musicianRepo: MusicianRepository = {
    listForOrg: async () => ({ items: [], totalCount: 0, hasMore: false }),
    listNamesForOrg: async () => [],
    getById: async () => null,
    getByUserId: async () =>
      musicianId
        ? {
            id: musicianId,
            organizationId: 'org-1',
            fullName: 'Professor',
            birthDate: null,
            phone: null,
            email: null,
            userId: 'user-1',
            notes: null,
          }
        : null,
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    merge: vi.fn(),
  };

  const assignmentRepo: AssignmentRepository = {
    listForMusician: async () =>
      assignments.map((assignment) => ({
        id: `a-${assignment.groupId}-${assignment.ensembleRole}`,
        organizationId: 'org-1',
        musicianId: musicianId ?? 'teacher-1',
        groupId: assignment.groupId,
        sectionId: null,
        partId: null,
        ensembleRole: assignment.ensembleRole,
        groupName: 'Turma',
        sectionName: null,
        partName: null,
      })),
    listForGroup: async () => [],
    listForGroups: async () =>
      (options?.students ?? [{ musicianId: 'student-1', groupId: 'class-1' }]).map((row) => ({
        musicianId: row.musicianId,
        musicianName: row.musicianId,
        musicianUserId: null,
        groupId: row.groupId,
      })),
    listPartNamesByMusicianIds: async () => new Map(),
    getById: async () => null,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const eventRepo: EventRepository = {
    listInRange: async () => [],
    getById: async () => options?.existing ?? eventDetail(),
    create: async (_org, input) => {
      const createdEvent = eventDetail({
        groups: (input.groupIds ?? []).map((id) => ({
          id,
          name: id,
          kind: 'ensemble' as const,
        })),
        musicians: (input.musicianIds ?? []).map((id) => ({
          id,
          fullName: id,
          userId: null,
        })),
      });
      created.push(createdEvent);
      return createdEvent;
    },
    update: async (_org, _id, input) =>
      eventDetail({
        groups: (input.groupIds ?? []).map((id) => ({
          id,
          name: id,
          kind: 'ensemble' as const,
        })),
        musicians: (input.musicianIds ?? []).map((id) => ({
          id,
          fullName: id,
          userId: null,
        })),
      }),
    replaceProgram: vi.fn(),
    delete: vi.fn(),
  };

  return { membershipRepo, musicianRepo, assignmentRepo, eventRepo, created };
}

const validInput = {
  typeId: 'type-1',
  startsAt: '2026-08-18T10:00:00.000Z',
};

describe('scheduleEvent audience', () => {
  it('rejects a member who is not a teacher', async () => {
    const repos = createRepos({ assignments: [], musicianId: 'member-1' });

    const result = await scheduleEvent(
      repos.eventRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-1',
      validInput,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('cannot_create_event');
    }
  });

  it('rejects a teacher associating a group they do not teach', async () => {
    const repos = createRepos();
    const result = await scheduleEvent(
      repos.eventRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-1',
      { ...validInput, groupIds: ['orchestra'] },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('audience_group_not_allowed');
    }
  });

  it('allows a teacher to associate their class and a student', async () => {
    const repos = createRepos();
    const result = await scheduleEvent(
      repos.eventRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-1',
      { ...validInput, groupIds: ['class-1'], musicianIds: ['student-1'] },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.groups.map((group) => group.id)).toEqual(['class-1']);
      expect(result.value.musicians.map((musician) => musician.id)).toEqual(
        expect.arrayContaining(['student-1', 'teacher-1']),
      );
    }
  });

  it('allows a conductor to associate their group', async () => {
    const repos = createRepos({
      musicianId: 'conductor-1',
      assignments: [{ groupId: 'orchestra', ensembleRole: 'conductor' }],
      students: [{ musicianId: 'player-1', groupId: 'orchestra' }],
    });

    const result = await scheduleEvent(
      repos.eventRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-1',
      { ...validInput, groupIds: ['orchestra'], musicianIds: ['player-1'] },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.groups.map((group) => group.id)).toEqual(['orchestra']);
      expect(result.value.musicians.map((musician) => musician.id)).toEqual(
        expect.arrayContaining(['player-1', 'conductor-1']),
      );
    }
  });

  it('rejects a conductor associating a group they do not conduct', async () => {
    const repos = createRepos({
      musicianId: 'conductor-1',
      assignments: [{ groupId: 'orchestra', ensembleRole: 'conductor' }],
    });

    const result = await scheduleEvent(
      repos.eventRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-1',
      { ...validInput, groupIds: ['class-1'] },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('audience_group_not_allowed');
    }
  });

  it('unions teacher and conductor groups for audience', async () => {
    const repos = createRepos({
      musicianId: 'writer-1',
      assignments: [
        { groupId: 'class-1', ensembleRole: 'teacher' },
        { groupId: 'orchestra', ensembleRole: 'conductor' },
      ],
      students: [
        { musicianId: 'student-1', groupId: 'class-1' },
        { musicianId: 'player-1', groupId: 'orchestra' },
      ],
    });

    const result = await scheduleEvent(
      repos.eventRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-1',
      { ...validInput, groupIds: ['class-1', 'orchestra'] },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.groups.map((group) => group.id)).toEqual(['class-1', 'orchestra']);
    }
  });

  it('allows an owner to associate any group', async () => {
    const repos = createRepos({ role: 'owner', assignments: [] });

    const result = await scheduleEvent(
      repos.eventRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-1',
      { ...validInput, groupIds: ['orchestra'] },
    );

    expect(result.ok).toBe(true);
  });
});

describe('updateEvent audience', () => {
  it('rejects a teacher editing an event they cannot write', async () => {
    const repos = createRepos({
      existing: eventDetail({
        createdBy: 'owner',
        groups: [{ id: 'orchestra', name: 'Orquestra', kind: 'ensemble' }],
      }),
    });

    const result = await updateEvent(
      repos.eventRepo,
      repos.membershipRepo,
      repos.musicianRepo,
      repos.assignmentRepo,
      'org-1',
      'user-1',
      'event-1',
      validInput,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_allowed');
    }
  });
});
