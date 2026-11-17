import { describe, expect, it } from 'vitest';
import type { EventListItem } from '@/domain/agenda';
import { findNextEventForAudience } from '@/ui/features/practice/next-event';

function event(overrides: Partial<EventListItem>): EventListItem {
  return {
    id: 'e',
    typeId: 't',
    typeName: 'Aula',
    typeKind: 'class',
    typeColor: null,
    title: null,
    startsAt: '2026-11-06T18:00:00.000Z',
    endsAt: null,
    location: null,
    programCount: 0,
    createdBy: null,
    groups: [],
    musicians: [],
    recurrenceId: null,
    isException: false,
    cancelledAt: null,
    allParticipantsAbsent: false,
    ...overrides,
  };
}

const NOW = new Date('2026-11-04T12:00:00.000Z');

describe('findNextEventForAudience', () => {
  it('escolhe o primeiro evento futuro do grupo ou do aluno', () => {
    const events = [
      event({ id: 'past', startsAt: '2026-11-03T18:00:00.000Z', groups: [{ id: 'g1', name: 'A', kind: 'class' }] }),
      event({ id: 'later', startsAt: '2026-11-10T18:00:00.000Z', groups: [{ id: 'g1', name: 'A', kind: 'class' }] }),
      event({ id: 'other', startsAt: '2026-11-05T18:00:00.000Z', groups: [{ id: 'g2', name: 'B', kind: 'class' }] }),
      event({ id: 'next', startsAt: '2026-11-06T18:00:00.000Z', musicians: [{ id: 'm1', fullName: 'Ana', userId: null }] }),
    ];
    expect(findNextEventForAudience(events, { groupIds: ['g1'], musicianIds: ['m1'] }, NOW)?.id).toBe(
      'next',
    );
  });

  it('ignora cancelados e público vazio', () => {
    const events = [
      event({ cancelledAt: '2026-11-01T00:00:00.000Z', groups: [{ id: 'g1', name: 'A', kind: 'class' }] }),
    ];
    expect(findNextEventForAudience(events, { groupIds: ['g1'], musicianIds: [] }, NOW)).toBeNull();
    expect(findNextEventForAudience(events, { groupIds: [], musicianIds: [] }, NOW)).toBeNull();
  });
});
