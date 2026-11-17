import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PracticeStudentRow, PracticeTaskDetail } from '@/application/practice';
import { usePractice } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { BackButton } from '@/ui/components/BackButton';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { IconPencil, IconTrash } from '@/ui/components/icons';
import { PracticeDailyStrip } from '@/ui/features/practice/PracticeDailyStrip';
import { PracticeReferenceSummary } from '@/ui/features/practice/PracticeReferenceSummary';
import { PracticeStatusBadge } from '@/ui/features/practice/PracticeStatusBadge';
import { PracticeSubmissionAudio } from '@/ui/features/practice/PracticeSubmissionAudio';
import {
  FeedbackNote,
  PracticeSubmissionReview,
  SubmissionMeta,
} from '@/ui/features/practice/PracticeSubmissionReview';
import { PracticeTaskAttempt } from '@/ui/features/practice/PracticeTaskAttempt';
import {
  formatPracticeDueAt,
  formatPracticeTaskSchedule,
  practiceErrorMessage,
} from '@/ui/features/practice/practice-labels';
import { practiceTaskEditPath, practiceTasksPath } from '@/ui/features/practice/practice-routes';
import { orgPageContentClass, scrollContentEndPaddingClass } from '@/ui/layouts/OrgListPageLayout';

/** Botão secundário sobre o fundo da página: preenchido, não só contorno. */
const secondaryButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm hover:bg-bg disabled:opacity-50';
const sectionLabelClass = 'text-xs font-medium uppercase tracking-wide text-muted';
const headerIconButtonClass =
  'rounded-lg border border-border bg-surface p-2 text-muted shadow-sm hover:bg-bg hover:text-text';

type StudentReviewRowProps = {
  organizationId: string;
  userId: string;
  dueAt: string;
  isDaily: boolean;
  row: PracticeStudentRow;
  onReviewed: () => void;
};

function StudentReviewRow({
  organizationId,
  userId,
  dueAt,
  isDaily,
  row,
  onReviewed,
}: StudentReviewRowProps) {
  const latest = row.progress.latestSubmission;
  const [expanded, setExpanded] = useState(row.progress.status === 'submitted');

  return (
    <li className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        disabled={!latest}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-text">{row.musicianName}</span>
          {/* Sem envio, o selo (pendente / atrasada / não entregue) já diz tudo. */}
          {latest ? <SubmissionMeta submission={latest} dueAt={dueAt} /> : null}
          {row.progress.daily ? (
            <span className="mt-1 block">
              <PracticeDailyStrip progress={row.progress.daily} />
            </span>
          ) : null}
        </span>
        <PracticeStatusBadge status={row.progress.status} />
      </button>

      {expanded && latest ? (
        <div className="border-t border-border px-4 py-3">
          <PracticeSubmissionReview
            organizationId={organizationId}
            userId={userId}
            dueAt={dueAt}
            submissions={row.submissions}
            isDaily={isDaily}
            onReviewed={onReviewed}
          />
        </div>
      ) : null}
    </li>
  );
}

export function PracticeTaskDetailPage() {
  const { orgSlug, taskId } = useParams();
  const navigate = useNavigate();
  const practice = usePractice();
  const { userId } = useAuth();
  const { resolveOrgBySlug } = useOrg();
  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;

  const [detail, setDetail] = useState<PracticeTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('practice-task-detail', isLoading);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    if (!org || !userId || !taskId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const result = await practice.getTask(org.id, userId, taskId);
    if (result.ok) {
      setDetail(result.value);
      setError(null);
    } else {
      setError(practiceErrorMessage(result.error));
    }
    setIsLoading(false);
  }, [org, practice, taskId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!orgSlug || !org || !userId) {
    return null;
  }

  if (error || (!isLoading && !detail)) {
    return (
      <div className={`${orgPageContentClass} space-y-4`}>
        <BackButton fallbackTo={practiceTasksPath(orgSlug)} />
        <p className="text-sm text-muted">{error ?? practiceErrorMessage('not_found')}</p>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const { task, canManage, students, mine } = detail;
  const closed = task.closedAt !== null;
  const isDaily = task.cadence === 'daily';

  async function toggleClosed() {
    if (!org || !userId) {
      return;
    }
    setIsBusy(true);
    setActionError(null);
    const result = await practice.setTaskClosed(org.id, userId, task.id, !closed);
    setIsBusy(false);
    if (!result.ok) {
      setActionError(practiceErrorMessage(result.error));
      return;
    }
    void load();
  }

  async function confirmDelete() {
    if (!org || !userId || !orgSlug) {
      return;
    }
    setIsBusy(true);
    const result = await practice.deleteTask(org.id, userId, task.id);
    setIsBusy(false);
    if (!result.ok) {
      setDeleteOpen(false);
      setActionError(practiceErrorMessage(result.error));
      return;
    }
    navigate(practiceTasksPath(orgSlug), { replace: true });
  }

  const audienceLabel = [
    ...task.groups.map((group) => group.name),
    ...task.musicians.map((musician) => musician.name),
  ]
    .filter(Boolean)
    .join(', ');

  const toReview = students.filter((row) => row.progress.status === 'submitted');
  // Na diária, "entregou" é ter entregado o dia em aberto (normalmente hoje).
  const delivered = isDaily
    ? students.filter((row) => row.progress.status === 'submitted' || row.progress.status === 'reviewed')
        .length
    : students.filter((row) => row.progress.latestSubmission !== null).length;
  const others = students.filter((row) => row.progress.status !== 'submitted');

  return (
    <div className={`${orgPageContentClass} min-h-0 flex-1 overflow-y-auto ${scrollContentEndPaddingClass}`}>
      <div className="space-y-6">
        <div className="flex items-start gap-2">
          <BackButton fallbackTo={practiceTasksPath(orgSlug)} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-text">{task.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {isDaily ? (
                formatPracticeTaskSchedule(task)
              ) : (
                <>
                  Até {formatPracticeDueAt(task.dueAt)}
                  {task.acceptLateSubmissions ? '' : ' · sem envios atrasados'}
                </>
              )}
              {closed ? ' · Encerrada' : ''}
              {canManage && audienceLabel ? ` · ${audienceLabel}` : ''}
            </p>
          </div>
          {canManage ? (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => navigate(practiceTaskEditPath(orgSlug, task.id))}
                aria-label="Editar tarefa"
                className={headerIconButtonClass}
              >
                <IconPencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                aria-label="Excluir tarefa"
                className={headerIconButtonClass}
              >
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <div>
            <h2 className={sectionLabelClass}>Instruções</h2>
            {task.instructions ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-text">{task.instructions}</p>
            ) : (
              <p className="mt-1 text-sm text-muted">Sem instruções.</p>
            )}
          </div>
          {task.reference.kind !== 'none' ? (
            <div className="border-t border-border pt-4">
              <PracticeReferenceSummary
                orgSlug={orgSlug}
                organizationId={org.id}
                taskId={task.id}
                reference={task.reference}
                labelClassName={sectionLabelClass}
              />
            </div>
          ) : null}
        </section>

        {actionError ? <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p> : null}

        {mine ? (
          <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-text">
                {isDaily ? 'Suas entregas' : 'Sua entrega'}
              </h2>
              <PracticeStatusBadge status={mine.progress.status} />
            </div>
            {mine.progress.daily ? <PracticeDailyStrip progress={mine.progress.daily} /> : null}
            {mine.progress.latestSubmission ? (
              <div className="space-y-2">
                <SubmissionMeta submission={mine.progress.latestSubmission} dueAt={task.dueAt} />
                <PracticeSubmissionAudio
                  organizationId={org.id}
                  submissionId={mine.progress.latestSubmission.id}
                  mimeType={mine.progress.latestSubmission.mimeType}
                />
                <FeedbackNote submission={mine.progress.latestSubmission} />
              </div>
            ) : null}
            {mine.progress.canSubmit ? (
              <div
                className={
                  mine.progress.latestSubmission ? 'space-y-3 border-t border-border pt-3' : ''
                }
              >
                {isDaily ? (
                  <h3 className={sectionLabelClass}>Entrega de hoje</h3>
                ) : mine.progress.latestSubmission ? (
                  <h3 className={sectionLabelClass}>Nova tentativa</h3>
                ) : null}
                <PracticeTaskAttempt
                  orgSlug={orgSlug}
                  organizationId={org.id}
                  userId={userId}
                  task={task}
                  onSubmitted={() => void load()}
                />
              </div>
            ) : mine.progress.blockedReason === 'not_today' ? (
              <p className="text-sm text-muted">Hoje não é dia de entrega.</p>
            ) : mine.progress.blockedReason === 'past_due' ? (
              <p className="text-sm text-muted">
                {isDaily
                  ? 'O período desta tarefa terminou.'
                  : 'O prazo terminou e esta tarefa não aceita envios atrasados.'}
              </p>
            ) : null}
          </section>
        ) : null}

        {canManage ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-text">Entregas</h2>
                {students.length > 0 ? (
                  <p className="text-sm text-muted">
                    {delivered} de {students.length}{' '}
                    {students.length === 1 ? 'aluno entregou' : 'alunos entregaram'}
                    {isDaily ? ' hoje' : ''}
                    {toReview.length > 0 ? ` · ${toReview.length} para ouvir` : ''}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void toggleClosed()}
                disabled={isBusy}
                className={secondaryButtonClass}
              >
                {closed ? 'Reabrir tarefa' : 'Encerrar tarefa'}
              </button>
            </div>
            {students.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                <p className="text-text">Ninguém recebeu esta tarefa ainda.</p>
                <p className="mt-1">
                  {task.groups.length > 0
                    ? `${task.groups.map((group) => group.name).join(', ')} não ${
                        task.groups.length === 1 ? 'tem' : 'têm'
                      } alunos. Adicione músicos ao grupo ou escolha alunos ao editar a tarefa.`
                    : 'Edite a tarefa para escolher os alunos.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {[...toReview, ...others].map((row) => (
                  <StudentReviewRow
                    key={row.musicianId}
                    organizationId={org.id}
                    userId={userId}
                    dueAt={task.dueAt}
                    isDaily={isDaily}
                    row={row}
                    onReviewed={() => void load()}
                  />
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Excluir tarefa"
        message="Excluir a tarefa e todas as gravações enviadas pelos alunos? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteOpen(false)}
        isConfirming={isBusy}
      />
    </div>
  );
}
