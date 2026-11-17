import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  summarizePracticeLesson,
  type PracticeLessonStudentSummary,
  type PracticeOverviewAudience,
  type PracticeStudentsOverview,
  type PracticeStudentTaskItem,
} from '@/application/practice';
import type { PracticeTask } from '@/domain/practice';
import { useAgenda, usePractice } from '@/ui/app/AppServicesContext';
import { Modal } from '@/ui/components/Modal';
import { IconChevronDown, IconPlus } from '@/ui/components/icons';
import { PracticeStatusBadge } from '@/ui/features/practice/PracticeStatusBadge';
import { PracticeSubmissionReview } from '@/ui/features/practice/PracticeSubmissionReview';
import { PracticeTaskForm } from '@/ui/features/practice/PracticeTaskForm';
import {
  formatPracticeTaskSchedule,
  practiceErrorMessage,
} from '@/ui/features/practice/practice-labels';
import {
  practiceReaderPath,
  practiceTaskPath,
  type PracticeTaskPrefill,
} from '@/ui/features/practice/practice-routes';

const sectionLabelClass = 'text-xs font-medium uppercase tracking-wide text-muted';
const inCardLinkClass =
  'inline-flex items-center rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-medium text-text hover:border-primary/40';
const newTaskButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50';

function referenceLabel(task: PracticeTask): string | null {
  const reference = task.reference;
  if (reference.kind !== 'file' || reference.location.kind === 'whole_file') {
    return null;
  }
  return reference.location.kind === 'toc'
    ? reference.location.label
    : `Página ${reference.location.page}`;
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; overview: PracticeStudentsOverview };

function usePracticeStudentsOverview(
  organizationId: string,
  userId: string,
  audience: PracticeOverviewAudience,
) {
  const practice = usePractice();
  const [state, setState] = useState<OverviewState>({ status: 'loading' });

  const load = useCallback(async () => {
    const result = await practice.listStudentsOverview(organizationId, userId, audience);
    setState(
      result.ok
        ? { status: 'ready', overview: result.value }
        : { status: 'error', message: practiceErrorMessage(result.error) },
    );
  }, [audience, organizationId, practice, userId]);

  useEffect(() => {
    setState({ status: 'loading' });
    void load();
  }, [load]);

  return { state, reload: load };
}

// ---------------------------------------------------------------------------
// Linha de tarefa de um aluno
// ---------------------------------------------------------------------------

type StudentTaskRowProps = {
  orgSlug: string;
  organizationId: string;
  userId: string;
  item: PracticeStudentTaskItem;
  onChanged: () => void;
};

function StudentTaskRow({ orgSlug, organizationId, userId, item, onChanged }: StudentTaskRowProps) {
  const { task, progress, submissions } = item;
  const [expanded, setExpanded] = useState(progress.status === 'submitted');
  const location = referenceLabel(task);

  return (
    <li className="rounded-lg border border-border bg-bg">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-text">{task.title}</span>
          <span className="block truncate text-xs text-muted">
            {location ? `${location} · ` : ''}
            {task.closedAt ? 'encerrada' : formatPracticeTaskSchedule(task)}
          </span>
        </span>
        <PracticeStatusBadge status={progress.status} />
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-border bg-surface px-3 py-3">
          {submissions.length > 0 ? (
            <PracticeSubmissionReview
              organizationId={organizationId}
              userId={userId}
              dueAt={task.dueAt}
              submissions={submissions}
              isDaily={task.cadence === 'daily'}
              onReviewed={onChanged}
            />
          ) : (
            <p className="text-sm text-muted">
              {progress.status === 'pending'
                ? 'Ainda não entregou; o prazo não terminou.'
                : 'Não entregou.'}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {task.reference.kind === 'file' ? (
              <Link
                to={practiceReaderPath(orgSlug, task.id, task.reference)}
                className={inCardLinkClass}
              >
                Abrir trecho
              </Link>
            ) : null}
            <Link to={practiceTaskPath(orgSlug, task.id)} className={inCardLinkClass}>
              Ver tarefa
            </Link>
          </div>
        </div>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Formulário em modal (sem sair da página)
// ---------------------------------------------------------------------------

function NewTaskModal({
  organizationId,
  userId,
  prefill,
  title,
  onClose,
  onSaved,
}: {
  organizationId: string;
  userId: string;
  prefill: PracticeTaskPrefill;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <PracticeTaskForm
        organizationId={organizationId}
        userId={userId}
        prefill={prefill}
        onSaved={onSaved}
        onCancel={onClose}
      />
    </Modal>
  );
}

function StatePlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Tarefas do evento: cobrança na aula, por aluno
// ---------------------------------------------------------------------------

function StudentLessonCard({
  orgSlug,
  organizationId,
  userId,
  summary,
  absent,
  onChanged,
}: {
  orgSlug: string;
  organizationId: string;
  userId: string;
  summary: PracticeLessonStudentSummary;
  absent: boolean;
  onChanged: () => void;
}) {
  const { counts } = summary;
  const needsAttention = counts.collect + counts.listen > 0;
  const [expanded, setExpanded] = useState(needsAttention && !absent);

  const chips: Array<{ label: string; className: string }> = [];
  if (counts.collect > 0) {
    chips.push({
      label: `${counts.collect} a cobrar`,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    });
  }
  if (counts.listen > 0) {
    chips.push({ label: `${counts.listen} para ouvir`, className: 'bg-primary/10 text-primary' });
  }
  if (chips.length === 0) {
    chips.push({
      label: summary.items.length === 0 ? 'Sem tarefas' : 'Em dia',
      className: 'bg-bg text-muted',
    });
  }

  return (
    <li className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        disabled={summary.items.length === 0}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 truncate font-medium text-text">
          {summary.musicianName}
          {absent ? <span className="ml-1.5 text-xs font-normal text-muted">ausente</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip.className}`}
            >
              {chip.label}
            </span>
          ))}
          {summary.items.length > 0 ? (
            <IconChevronDown
              className={`h-4 w-4 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          ) : null}
        </span>
      </button>
      {expanded && summary.items.length > 0 ? (
        <ul className="space-y-2 border-t border-border px-4 py-3">
          {summary.items.map((item) => (
            <StudentTaskRow
              key={item.task.id}
              orgSlug={orgSlug}
              organizationId={organizationId}
              userId={userId}
              item={item}
              onChanged={onChanged}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

type EventPracticeTasksSectionProps = {
  orgSlug: string;
  organizationId: string;
  userId: string;
  eventId: string;
  startsAt: string;
  groupIds: string[];
  musicians: Array<{ id: string; name: string }>;
};

export function EventPracticeTasksSection({
  orgSlug,
  organizationId,
  userId,
  eventId,
  startsAt,
  groupIds,
  musicians,
}: EventPracticeTasksSectionProps) {
  const agenda = useAgenda();
  const audienceKey = `${groupIds.join(',')}|${musicians.map((musician) => musician.id).join(',')}`;
  const audience = useMemo<PracticeOverviewAudience>(
    () => ({
      groupIds,
      musicians: musicians.map((musician) => ({
        musicianId: musician.id,
        musicianName: musician.name,
      })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave resume o público
    [audienceKey],
  );
  const { state, reload } = usePracticeStudentsOverview(organizationId, userId, audience);
  const [absentIds, setAbsentIds] = useState<Set<string>>(() => new Set());
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void agenda.listEventAbsences(organizationId, userId, eventId).then((result) => {
      if (!cancelled && result.ok) {
        setAbsentIds(new Set(result.value.absentMusicianIds));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [agenda, eventId, organizationId, userId]);

  const summaries = useMemo(() => {
    if (state.status !== 'ready') {
      return [];
    }
    const sorted = summarizePracticeLesson(state.overview.students);
    // Ausentes no fim: não dá para cobrar quem não veio.
    return [
      ...sorted.filter((summary) => !absentIds.has(summary.musicianId)),
      ...sorted.filter((summary) => absentIds.has(summary.musicianId)),
    ];
  }, [absentIds, state]);

  const prefill = useMemo<PracticeTaskPrefill>(
    () => ({ groupIds, musicianIds: musicians.map((musician) => musician.id), nextAfter: startsAt }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a chave resume o público
    [audienceKey, startsAt],
  );

  if (state.status === 'loading') {
    return <StatePlaceholder>Carregando tarefas…</StatePlaceholder>;
  }
  if (state.status === 'error') {
    return (
      <StatePlaceholder>
        <p>{state.message}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-medium text-text"
        >
          Tentar de novo
        </button>
      </StatePlaceholder>
    );
  }

  const { canCreate } = state.overview;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={sectionLabelClass}>Tarefas dos alunos</h2>
        {canCreate ? (
          <button type="button" onClick={() => setFormOpen(true)} className={newTaskButtonClass}>
            <IconPlus className="h-4 w-4" />
            Nova tarefa para o próximo encontro
          </button>
        ) : null}
      </div>

      {summaries.length === 0 ? (
        <StatePlaceholder>Este evento não tem alunos.</StatePlaceholder>
      ) : (
        <ul className="space-y-2">
          {summaries.map((summary) => (
            <StudentLessonCard
              key={summary.musicianId}
              orgSlug={orgSlug}
              organizationId={organizationId}
              userId={userId}
              summary={summary}
              absent={absentIds.has(summary.musicianId)}
              onChanged={() => void reload()}
            />
          ))}
        </ul>
      )}

      {formOpen ? (
        <NewTaskModal
          organizationId={organizationId}
          userId={userId}
          prefill={prefill}
          title="Nova tarefa para o próximo encontro"
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Tarefas no cadastro do aluno
// ---------------------------------------------------------------------------

type MusicianPracticeTasksSectionProps = {
  orgSlug: string;
  organizationId: string;
  userId: string;
  musicianId: string;
  musicianName: string;
};

export function MusicianPracticeTasksSection({
  orgSlug,
  organizationId,
  userId,
  musicianId,
  musicianName,
}: MusicianPracticeTasksSectionProps) {
  const audience = useMemo<PracticeOverviewAudience>(
    () => ({ groupIds: [], musicians: [{ musicianId, musicianName }] }),
    [musicianId, musicianName],
  );
  const { state, reload } = usePracticeStudentsOverview(organizationId, userId, audience);
  const [formOpen, setFormOpen] = useState(false);
  const prefill = useMemo<PracticeTaskPrefill>(() => ({ musicianIds: [musicianId] }), [musicianId]);

  if (state.status === 'loading') {
    return <StatePlaceholder>Carregando tarefas…</StatePlaceholder>;
  }
  if (state.status === 'error') {
    return (
      <StatePlaceholder>
        <p>{state.message}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-medium text-text"
        >
          Tentar de novo
        </button>
      </StatePlaceholder>
    );
  }

  const student = state.overview.students[0];
  const items = student?.items ?? [];
  // Mesma ordem da aula: o que cobrar e o que ouvir primeiro.
  const open = student ? (summarizePracticeLesson([student])[0]?.items ?? []) : [];
  const openIds = new Set(open.map((item) => item.task.id));
  const closed = items.filter((item) => !openIds.has(item.task.id));

  const renderList = (list: PracticeStudentTaskItem[]) => (
    <ul className="space-y-2">
      {list.map((item) => (
        <StudentTaskRow
          key={item.task.id}
          orgSlug={orgSlug}
          organizationId={organizationId}
          userId={userId}
          item={item}
          onChanged={() => void reload()}
        />
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      {state.overview.canCreate ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => setFormOpen(true)} className={newTaskButtonClass}>
            <IconPlus className="h-4 w-4" />
            Nova tarefa para {musicianName.split(' ')[0]}
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <StatePlaceholder>Nenhuma tarefa para este aluno.</StatePlaceholder>
      ) : (
        <>
          <section className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <h2 className={sectionLabelClass}>Em aberto</h2>
            {open.length > 0 ? (
              renderList(open)
            ) : (
              <p className="text-sm text-muted">Nenhuma tarefa em aberto.</p>
            )}
          </section>
          {closed.length > 0 ? (
            <section className="space-y-2 rounded-xl border border-border bg-surface p-4">
              <h2 className={sectionLabelClass}>Encerradas</h2>
              {renderList(closed)}
            </section>
          ) : null}
        </>
      )}

      {formOpen ? (
        <NewTaskModal
          organizationId={organizationId}
          userId={userId}
          prefill={prefill}
          title={`Nova tarefa para ${musicianName}`}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}
