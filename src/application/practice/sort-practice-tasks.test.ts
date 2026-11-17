import { describe, expect, it } from 'vitest';
import type { PracticeTask } from '@/domain/practice';
import { sortPracticeTaskItems } from '@/application/practice/task-use-cases';

function item(id: string, dueAt: string, closedAt: string | null = null) {
  return { task: { id, dueAt, closedAt } as PracticeTask };
}

describe('sortPracticeTaskItems', () => {
  it('em andamento primeiro, depois vencidas, depois encerradas', () => {
    const now = new Date('2026-11-04T12:00:00Z');
    const sorted = sortPracticeTaskItems(
      [
        item('encerrada-antiga', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'),
        item('vencida-antiga', '2026-10-30T00:00:00Z'),
        item('andamento-longe', '2026-11-20T00:00:00Z'),
        item('vencida-recente', '2026-11-03T00:00:00Z'),
        item('encerrada-recente', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'),
        item('andamento-perto', '2026-11-05T00:00:00Z'),
      ],
      now,
    );
    expect(sorted.map((entry) => entry.task.id)).toEqual([
      'andamento-perto',
      'andamento-longe',
      'vencida-recente',
      'vencida-antiga',
      'encerrada-recente',
      'encerrada-antiga',
    ]);
  });
});
