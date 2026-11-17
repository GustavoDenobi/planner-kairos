import { describe, expect, it } from 'vitest';
import type { PracticeTask } from '@/domain/practice';
import { resolvePracticeTaskStudentProgress } from '@/domain/practice';
import { buildAgendaPracticeTaskItems } from '@/ui/features/agenda/agenda-practice-tasks';

// Semana de dom 08/11 a sáb 14/11/2026; agora é qua 11/11, meio-dia em Brasília.
const RANGE = { from: new Date(2026, 10, 8), to: new Date(2026, 10, 15) };
const NOW = new Date('2026-11-11T15:00:00.000Z');

function task(overrides: Partial<PracticeTask> = {}): PracticeTask {
  return {
    id: 'task-1',
    organizationId: 'org-1',
    createdBy: 'teacher',
    title: 'Escala',
    instructions: '',
    reference: { kind: 'none' },
    cadence: 'once',
    daily: null,
    timeZone: 'America/Sao_Paulo',
    dueAt: '2026-11-12T15:00:00.000Z',
    acceptLateSubmissions: true,
    linkedEventId: null,
    closedAt: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    groups: [],
    musicians: [],
    ...overrides,
  };
}

function item(value: PracticeTask) {
  return {
    task: value,
    progress: resolvePracticeTaskStudentProgress({ task: value, submissions: [], now: NOW }),
  };
}

describe('buildAgendaPracticeTaskItems', () => {
  it('tarefa de uma vez aparece no dia do prazo', () => {
    const items = buildAgendaPracticeTaskItems([item(task())], RANGE);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ cadence: 'once', status: 'pending' });
    expect(items[0].date).toEqual(new Date(2026, 10, 12));
  });

  it('prazo fora da semana não aparece', () => {
    const items = buildAgendaPracticeTaskItems(
      [item(task({ dueAt: '2026-11-20T15:00:00.000Z' }))],
      RANGE,
    );
    expect(items).toEqual([]);
  });

  it('tarefa diária aparece em cada dia de entrega da semana', () => {
    const daily = task({
      cadence: 'daily',
      daily: { startsOn: '2026-11-09', endsOn: '2026-11-20', weekdays: [1, 2, 3, 4, 5] },
      dueAt: '2026-11-21T02:59:59.000Z',
      acceptLateSubmissions: false,
    });
    const items = buildAgendaPracticeTaskItems([item(daily)], RANGE);
    expect(
      items.map((entry) => [entry.date.getDate(), entry.cadence === 'daily' && entry.dayState]),
    ).toEqual([
      [9, 'missed'],
      [10, 'missed'],
      [11, 'open'],
      [12, 'upcoming'],
      [13, 'upcoming'],
    ]);
  });
});
