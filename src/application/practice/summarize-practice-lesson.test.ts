import { describe, expect, it } from 'vitest';
import type {
  PracticeTask,
  PracticeTaskStudentProgress,
  PracticeTaskStudentStatus,
} from '@/domain/practice';
import {
  summarizePracticeLesson,
  type PracticeStudentOverview,
} from '@/application/practice/student-overview-use-cases';

function item(id: string, status: PracticeTaskStudentStatus, closed = false, day = 5) {
  return {
    task: {
      id,
      dueAt: `2026-11-${String(day).padStart(2, '0')}T12:00:00Z`,
      closedAt: closed ? '2026-11-01T00:00:00Z' : null,
    } as PracticeTask,
    progress: { status } as PracticeTaskStudentProgress,
    submissions: [],
  };
}

function student(name: string, items: PracticeStudentOverview['items']): PracticeStudentOverview {
  return { musicianId: name, musicianName: name, items };
}

describe('summarizePracticeLesson', () => {
  it('põe primeiro o que cobrar, depois o que ouvir, e esconde encerradas já resolvidas', () => {
    const [ana] = summarizePracticeLesson([
      student('Ana', [
        item('andamento', 'pending'),
        item('ouvir', 'submitted', false, 3),
        item('atrasada', 'late'),
        item('encerrada-revisada', 'reviewed', true),
        item('encerrada-sem-ouvir', 'submitted', true, 4),
      ]),
    ]);
    expect(ana.items.map((entry) => entry.task.id)).toEqual([
      'atrasada',
      'ouvir',
      'encerrada-sem-ouvir',
      'andamento',
    ]);
    expect(ana.counts).toEqual({ collect: 1, listen: 2, ongoing: 1, done: 0 });
  });

  it('ordena alunos: a cobrar, depois a ouvir, depois em dia (por nome)', () => {
    const order = summarizePracticeLesson([
      student('Bruno', [item('b', 'reviewed')]),
      student('Carla', [item('c', 'submitted')]),
      student('Ana', []),
      student('Diego', [item('d', 'redo_requested')]),
    ]).map((summary) => summary.musicianName);
    expect(order).toEqual(['Diego', 'Carla', 'Ana', 'Bruno']);
  });
});
