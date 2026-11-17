import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  AssignedPracticeTaskItem,
  ManagedPracticeTaskItem,
  PracticeTaskList,
} from '@/application/practice';
import { usePractice } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { IconPlus } from '@/ui/components/icons';
import { PracticeStatusBadge } from '@/ui/features/practice/PracticeStatusBadge';
import {
  formatPracticeTaskSchedule,
  practiceErrorMessage,
} from '@/ui/features/practice/practice-labels';
import { practiceTaskNewPath, practiceTaskPath } from '@/ui/features/practice/practice-routes';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import {
  orgListPageHeightClass,
  orgListScrollAreaClass,
  orgPageContentClass,
} from '@/ui/layouts/OrgListPageLayout';

function audienceSummary(item: ManagedPracticeTaskItem): string {
  const parts = item.task.groups.map((group) => group.name);
  const direct = item.task.musicians.length;
  if (direct === 1 && parts.length === 0) {
    parts.push(item.task.musicians[0]!.name);
  } else if (direct > 0) {
    parts.push(`${direct} ${direct === 1 ? 'aluno' : 'alunos'}`);
  }
  return parts.join(', ');
}

function ManagedRow({ orgSlug, item }: { orgSlug: string; item: ManagedPracticeTaskItem }) {
  const { task, counts } = item;
  const delivered = counts.submitted + counts.reviewed + counts.redoRequested;
  const closed = task.closedAt !== null;
  // Sem marca, uma tarefa vencida parecia igual às que ainda estão correndo.
  const pastDue = !closed && new Date(task.dueAt).getTime() < Date.now();

  return (
    <li>
      <Link
        to={practiceTaskPath(orgSlug, task.id)}
        className={`flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3 hover:border-primary/40 ${
          closed ? 'bg-bg' : 'bg-surface'
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate font-medium ${closed ? 'text-muted' : 'text-text'}`}>{task.title}</p>
          <p className="mt-0.5 truncate text-sm text-muted">
            {audienceSummary(item)} · {formatPracticeTaskSchedule(task)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {delivered} de {counts.students} {counts.students === 1 ? 'entregou' : 'entregaram'}
            {task.cadence === 'daily' && !closed && !pastDue ? ' hoje' : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {counts.submitted > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
              {counts.submitted} para ouvir
            </span>
          ) : null}
          {closed ? <span className="text-xs text-muted">Encerrada</span> : null}
          {pastDue ? <span className="text-xs text-muted">Prazo encerrado</span> : null}
        </div>
      </Link>
    </li>
  );
}

function AssignedRow({ orgSlug, item }: { orgSlug: string; item: AssignedPracticeTaskItem }) {
  const { task, progress } = item;
  return (
    <li>
      <Link
        to={practiceTaskPath(orgSlug, task.id)}
        className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-primary/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-text">{task.title}</p>
          <p className="mt-0.5 text-sm text-muted">{formatPracticeTaskSchedule(task)}</p>
        </div>
        <PracticeStatusBadge status={progress.status} />
      </Link>
    </li>
  );
}

export function PracticeTasksPage() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const practice = usePractice();
  const { userId } = useAuth();
  const { resolveOrgBySlug } = useOrg();
  const online = useOnlineStatus();
  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;

  const [list, setList] = useState<PracticeTaskList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('practice-tasks', isLoading);

  const load = useCallback(async () => {
    if (!org || !userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await practice.listTasks(org.id, userId);
    if (result.ok) {
      setList(result.value);
    } else {
      setError(practiceErrorMessage(result.error));
    }
    setIsLoading(false);
  }, [org, practice, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!orgSlug) {
    return null;
  }

  const managed = list?.managed ?? [];
  const assigned = list?.assigned ?? [];
  const isEmpty = !isLoading && list !== null && managed.length === 0 && assigned.length === 0;

  return (
    <div className={`flex flex-col ${orgPageContentClass} ${orgListPageHeightClass}`}>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">Tarefas</h1>
        {list?.canCreate && online ? (
          <button
            type="button"
            onClick={() => navigate(practiceTaskNewPath(orgSlug))}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <IconPlus className="h-4 w-4" />
            Nova tarefa
          </button>
        ) : null}
      </div>

      <div className={`mt-4 ${orgListScrollAreaClass}`}>
        {!online ? (
          <p className="mb-3 text-sm text-muted">
            Sem conexão. As tarefas aparecem quando a internet voltar; suas gravações continuam
            salvas neste aparelho.
          </p>
        ) : null}
        {error ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        {isEmpty ? (
          <div className="py-8 text-center text-sm text-muted">
            {list?.canCreate ? (
              <>
                <p>Nenhuma tarefa ainda.</p>
                <p className="mt-1">
                  Toque em <strong className="text-text">Nova tarefa</strong> para pedir que um aluno
                  ou turma grave algo até a próxima aula.
                </p>
              </>
            ) : (
              <p>Nenhuma tarefa para você no momento.</p>
            )}
          </div>
        ) : null}

        {assigned.length > 0 ? (
          <section className="mb-6">
            {managed.length > 0 ? (
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Para mim
              </h2>
            ) : null}
            <ul className="space-y-2">
              {assigned.map((item) => (
                <AssignedRow key={item.task.id} orgSlug={orgSlug} item={item} />
              ))}
            </ul>
          </section>
        ) : null}

        {managed.length > 0 ? (
          <section>
            {assigned.length > 0 ? (
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Que passei
              </h2>
            ) : null}
            <ul className="space-y-2">
              {managed.map((item) => (
                <ManagedRow key={item.task.id} orgSlug={orgSlug} item={item} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
