import { describe, expect, it } from 'vitest';
import {
  buildReaderTaskView,
  currentSectionStartPage,
  type ReaderTaskOption,
} from '@/ui/features/practice/reader-task-groups';

function managed(overrides: Partial<ReaderTaskOption>): ReaderTaskOption {
  return {
    taskId: 't',
    title: 'Tarefa',
    dueAt: '2026-11-10T18:00:00.000Z',
    scheduleLabel: 'até 18:00',
    role: 'manager',
    startPage: 6,
    locationLabel: 'Corda Mi',
    audienceLabel: 'Ana',
    students: 1,
    delivered: 0,
    toReview: 0,
    ...overrides,
  };
}

const OPTIONS: ReaderTaskOption[] = [
  managed({ taskId: 'mi-ana', audienceLabel: 'Ana', toReview: 1 }),
  managed({ taskId: 'mi-bruno', audienceLabel: 'Bruno' }),
  managed({ taskId: 'la-carla', startPage: 9, locationLabel: 'Corda Lá', audienceLabel: 'Carla' }),
  managed({ taskId: 'inteira', startPage: null, locationLabel: 'Partitura inteira', audienceLabel: 'Turma A' }),
  {
    taskId: 'minha',
    title: 'Minha',
    dueAt: '2026-11-08T18:00:00.000Z',
    scheduleLabel: 'até 18:00',
    role: 'student',
    startPage: 9,
    locationLabel: 'Corda Lá',
    audienceLabel: '',
    studentStatus: 'redo_requested',
  },
];

describe('currentSectionStartPage', () => {
  it('usa o último trecho que começa nesta página ou antes', () => {
    expect(currentSectionStartPage([6, 9, null], 7)).toBe(6);
    expect(currentSectionStartPage([6, 9], 9)).toBe(9);
    expect(currentSectionStartPage([6, 9], 3)).toBeNull();
  });
});

describe('buildReaderTaskView', () => {
  it('"Nesta página" mostra o trecho atual e a partitura inteira', () => {
    const view = buildReaderTaskView({ options: OPTIONS, filter: 'page', query: '', currentPage: 7 });
    expect(view.groups.map((group) => group.label)).toEqual(['Partitura inteira', 'Corda Mi · p. 6']);
    // Quem tem gravação para ouvir vem primeiro no trecho.
    expect(view.groups[1]?.items.map((item) => item.taskId)).toEqual(['mi-ana', 'mi-bruno']);
    expect(view.groups[1]?.toReview).toBe(1);
  });

  it('"Todas" agrupa por trecho na ordem das páginas e marca o atual', () => {
    const view = buildReaderTaskView({ options: OPTIONS, filter: 'all', query: '', currentPage: 9 });
    expect(view.groups.map((group) => [group.label, group.isCurrent])).toEqual([
      ['Partitura inteira', true],
      ['Corda Mi · p. 6', false],
      ['Corda Lá · p. 9', true],
    ]);
  });

  it('"Para ouvir" mostra só o que espera revisão', () => {
    const view = buildReaderTaskView({ options: OPTIONS, filter: 'review', query: '', currentPage: 1 });
    expect(view.groups.flatMap((group) => group.items.map((item) => item.taskId))).toEqual(['mi-ana']);
  });

  it('a busca por aluno ignora o filtro de página', () => {
    const view = buildReaderTaskView({ options: OPTIONS, filter: 'page', query: 'carla', currentPage: 6 });
    expect(view.groups.flatMap((group) => group.items.map((item) => item.taskId))).toEqual(['la-carla']);
  });

  it('o número do botão conta só o que pede ação', () => {
    const view = buildReaderTaskView({ options: OPTIONS, filter: 'page', query: '', currentPage: 1 });
    // 1 envio para ouvir + 1 tarefa minha para refazer.
    expect(view.attentionCount).toBe(2);
    expect(view.mine.map((item) => item.taskId)).toEqual(['minha']);
    expect(view.totalManaged).toBe(4);
  });
});
