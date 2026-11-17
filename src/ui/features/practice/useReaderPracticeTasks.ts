import { useCallback, useEffect, useState } from 'react';
import type { PracticeTaskDetail, PracticeTaskList } from '@/application/practice';
import { practiceTaskReferenceStartPage, type PracticeTask } from '@/domain/practice';
import { formatPracticeTaskSchedule } from '@/ui/features/practice/practice-labels';
import {
  pageLocationLabel,
  type ReaderTaskOption,
} from '@/ui/features/practice/reader-task-groups';
import { usePractice } from '@/ui/app/AppServicesContext';

/** Estado da lista no leitor: o botão de tarefas fica sempre visível e explica cada caso. */
export type ReaderTaskListStatus = 'loading' | 'ready' | 'error' | 'offline';

type UseReaderPracticeTasksOptions = {
  organizationId: string | null;
  userId: string | null;
  pieceFileId: string | null;
  /** Tarefa vinda do link "Abrir trecho" (?tarefa=). */
  initialTaskId: string | null;
  online: boolean;
};

export type { ReaderTaskOption as ReaderPracticeTaskOption } from '@/ui/features/practice/reader-task-groups';

function locationLabel(reference: PracticeTask['reference']): string {
  if (reference.kind !== 'file' || reference.location.kind === 'whole_file') {
    return 'Partitura inteira';
  }
  return reference.location.kind === 'toc'
    ? reference.location.label
    : pageLocationLabel(reference.location.page);
}

function audienceLabel(task: PracticeTask): string {
  const names = [...task.groups.map((group) => group.name)];
  const direct = task.musicians.map((musician) => musician.name).filter(Boolean);
  if (direct.length <= 2) {
    names.push(...direct);
  } else {
    names.push(`${direct.length} alunos`);
  }
  return names.join(', ');
}

function startPageOf(task: PracticeTask): number | null {
  const reference = task.reference;
  if (reference.kind !== 'file' || reference.location.kind === 'whole_file') {
    return null;
  }
  return practiceTaskReferenceStartPage(reference);
}

/** Tarefas abertas ligadas ao arquivo exibido no leitor, e a tarefa em foco. */
export function useReaderPracticeTasks({
  organizationId,
  userId,
  pieceFileId,
  initialTaskId,
  online,
}: UseReaderPracticeTasksOptions) {
  const practice = usePractice();
  const [list, setList] = useState<PracticeTaskList | null>(null);
  const [listStatus, setListStatus] = useState<ReaderTaskListStatus>('loading');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(initialTaskId);
  const [activeDetail, setActiveDetail] = useState<PracticeTaskDetail | null>(null);

  useEffect(() => {
    setActiveTaskId(initialTaskId);
  }, [initialTaskId]);

  const loadList = useCallback(async () => {
    if (!organizationId || !userId || !pieceFileId) {
      setList(null);
      setListStatus('loading');
      return;
    }
    if (!online) {
      setList(null);
      setListStatus('offline');
      return;
    }
    setListStatus((current) => (current === 'ready' ? current : 'loading'));
    const result = await practice.listTasksForFile(organizationId, userId, pieceFileId);
    setList(result.ok ? result.value : null);
    setListStatus(result.ok ? 'ready' : 'error');
  }, [online, organizationId, pieceFileId, practice, userId]);

  const loadActive = useCallback(async () => {
    if (!organizationId || !userId || !activeTaskId || !online) {
      setActiveDetail(null);
      return;
    }
    const result = await practice.getTask(organizationId, userId, activeTaskId);
    setActiveDetail(result.ok ? result.value : null);
  }, [activeTaskId, online, organizationId, practice, userId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  const refresh = useCallback(() => {
    void loadList();
    void loadActive();
  }, [loadActive, loadList]);

  const options: ReaderTaskOption[] = [
    ...(list?.assigned ?? [])
      .filter((item) => item.task.closedAt === null)
      .map((item) => ({
        taskId: item.task.id,
        title: item.task.title,
        dueAt: item.task.dueAt,
        scheduleLabel: formatPracticeTaskSchedule(item.task),
        role: 'student' as const,
        startPage: startPageOf(item.task),
        locationLabel: locationLabel(item.task.reference),
        audienceLabel: '',
        studentStatus: item.progress.status,
      })),
    ...(list?.managed ?? [])
      .filter((item) => item.task.closedAt === null)
      .map((item) => ({
        taskId: item.task.id,
        title: item.task.title,
        dueAt: item.task.dueAt,
        scheduleLabel: formatPracticeTaskSchedule(item.task),
        role: 'manager' as const,
        startPage: startPageOf(item.task),
        locationLabel: locationLabel(item.task.reference),
        audienceLabel: audienceLabel(item.task),
        students: item.counts.students,
        delivered: item.counts.submitted + item.counts.reviewed + item.counts.redoRequested,
        toReview: item.counts.submitted,
      })),
  ];

  return {
    options,
    listStatus,
    canCreate: list?.canCreate ?? false,
    activeTaskId,
    activeDetail,
    setActiveTaskId,
    refresh,
  };
}
