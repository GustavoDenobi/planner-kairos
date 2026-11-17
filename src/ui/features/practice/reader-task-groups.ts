import type { PracticeTaskStudentStatus } from '@/domain/practice';
import { matchesSearchText } from '@/ui/utils/normalize-search-text';

/** Rótulo de tarefa marcada por página (sem item do sumário). */
export function pageLocationLabel(page: number): string {
  return `Página ${page}`;
}

export type ReaderTaskOption = {
  taskId: string;
  title: string;
  dueAt: string;
  /** "até qui., 12/11, 18:00" ou o período da tarefa diária. */
  scheduleLabel: string;
  role: 'student' | 'manager';
  /** Página em que o trecho começa (null = partitura inteira). */
  startPage: number | null;
  /** "Corda Mi", "Página 12" ou "Partitura inteira". */
  locationLabel: string;
  /** Para quem (só para quem gerencia). */
  audienceLabel: string;
  studentStatus?: PracticeTaskStudentStatus;
  students?: number;
  delivered?: number;
  toReview?: number;
};

export type ReaderTaskFilter = 'page' | 'review' | 'all';

export type ReaderTaskGroup = {
  key: string;
  label: string;
  startPage: number | null;
  /** Trecho em que o leitor está agora. */
  isCurrent: boolean;
  toReview: number;
  items: ReaderTaskOption[];
};

export type ReaderTaskView = {
  mine: ReaderTaskOption[];
  groups: ReaderTaskGroup[];
  /** Número para o botão: o que pede ação de quem está lendo. */
  attentionCount: number;
  totalManaged: number;
};

const STUDENT_ATTENTION: ReadonlySet<PracticeTaskStudentStatus> = new Set([
  'pending',
  'late',
  'redo_requested',
]);

export function readerTaskNeedsAttention(option: ReaderTaskOption): boolean {
  if (option.role === 'student') {
    return option.studentStatus !== undefined && STUDENT_ATTENTION.has(option.studentStatus);
  }
  return (option.toReview ?? 0) > 0;
}

function groupKey(option: ReaderTaskOption): string {
  return option.startPage === null ? 'whole' : `${option.startPage}:${option.locationLabel}`;
}

/** Início do trecho em que o leitor está: o último que começa nesta página ou antes. */
export function currentSectionStartPage(
  startPages: Iterable<number | null>,
  currentPage: number,
): number | null {
  let best: number | null = null;
  for (const page of startPages) {
    if (page !== null && page <= currentPage && (best === null || page > best)) {
      best = page;
    }
  }
  return best;
}

function matchesQuery(option: ReaderTaskOption, query: string): boolean {
  return (
    matchesSearchText(option.title, query) ||
    matchesSearchText(option.audienceLabel, query) ||
    matchesSearchText(option.locationLabel, query)
  );
}

/**
 * Organiza as tarefas do arquivo para o leitor: as do aluno à parte; as que a
 * pessoa passou, agrupadas por trecho na ordem das páginas e filtradas.
 */
export function buildReaderTaskView(input: {
  options: readonly ReaderTaskOption[];
  filter: ReaderTaskFilter;
  query: string;
  currentPage: number;
}): ReaderTaskView {
  const query = input.query.trim();
  const mineAll = input.options.filter((option) => option.role === 'student');
  const managedAll = input.options.filter((option) => option.role === 'manager');

  const attentionCount =
    mineAll.filter(readerTaskNeedsAttention).length +
    managedAll.reduce((sum, option) => sum + (option.toReview ?? 0), 0);

  const currentStart = currentSectionStartPage(
    managedAll.map((option) => option.startPage),
    input.currentPage,
  );

  const managed = managedAll.filter((option) => {
    if (query && !matchesQuery(option, query)) {
      return false;
    }
    if (input.filter === 'review') {
      return readerTaskNeedsAttention(option);
    }
    if (input.filter === 'page' && !query) {
      return option.startPage === null || option.startPage === currentStart;
    }
    return true;
  });

  const byKey = new Map<string, ReaderTaskGroup>();
  for (const option of managed) {
    const key = groupKey(option);
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        // Trecho do sumário ganha a página; "Página N" já diz onde é.
        label:
          option.startPage === null || option.locationLabel === pageLocationLabel(option.startPage)
            ? option.locationLabel
            : `${option.locationLabel} · p. ${option.startPage}`,
        startPage: option.startPage,
        isCurrent: option.startPage === null || option.startPage === currentStart,
        toReview: 0,
        items: [],
      };
      byKey.set(key, group);
    }
    group.items.push(option);
    group.toReview += option.toReview ?? 0;
  }

  const groups = [...byKey.values()].sort((a, b) => {
    // Partitura inteira primeiro; depois pela página do trecho.
    const pageA = a.startPage ?? 0;
    const pageB = b.startPage ?? 0;
    return pageA - pageB || a.label.localeCompare(b.label, 'pt-BR');
  });
  for (const group of groups) {
    group.items.sort(
      (a, b) =>
        Number(readerTaskNeedsAttention(b)) - Number(readerTaskNeedsAttention(a)) ||
        a.dueAt.localeCompare(b.dueAt),
    );
  }

  return {
    mine: query ? mineAll.filter((option) => matchesQuery(option, query)) : mineAll,
    groups,
    attentionCount,
    totalManaged: managedAll.length,
  };
}
