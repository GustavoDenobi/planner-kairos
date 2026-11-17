import { useState } from 'react';
import type { PracticeSubmission } from '@/domain/practice';
import { usePractice } from '@/ui/app/AppServicesContext';
import { PracticeSubmissionAudio } from '@/ui/features/practice/PracticeSubmissionAudio';
import {
  formatLocalDateWithWeekday,
  formatPracticeDateTime,
  practiceErrorMessage,
} from '@/ui/features/practice/practice-labels';
import { formatTimerMs } from '@/ui/features/study-tools/study-timer-format';

/** Botão secundário dentro de um card branco. */
const inCardButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-medium text-text hover:border-primary/40 disabled:opacity-50';

/** Abaixo disso, gravar e enviar contam como o mesmo momento. */
const RECORDED_EARLIER_THRESHOLD_MS = 30 * 60_000;

export function SubmissionMeta({
  submission,
  dueAt,
}: {
  submission: PracticeSubmission;
  dueAt: string;
}) {
  // Envio de tarefa diária pertence a um dia: não existe "depois do prazo".
  const late =
    submission.periodDate === null && Date.parse(submission.submittedAt) > Date.parse(dueAt);
  // Gravada bem antes do envio (ex.: sem internet na hora): os dois horários ficam visíveis.
  const recordedEarlier =
    submission.recordedAt !== null &&
    Date.parse(submission.submittedAt) - Date.parse(submission.recordedAt) >
      RECORDED_EARLIER_THRESHOLD_MS;
  return (
    <p className="text-xs text-muted tabular-nums">
      {submission.periodDate
        ? `Entrega de ${formatLocalDateWithWeekday(submission.periodDate)}`
        : `${submission.attempt}ª tentativa`}{' '}
      ·{' '}
      {recordedEarlier && submission.recordedAt
        ? `gravada em ${formatPracticeDateTime(submission.recordedAt)} · enviada em ${formatPracticeDateTime(submission.submittedAt)}`
        : formatPracticeDateTime(submission.submittedAt)}
      {late ? ' · depois do prazo' : ''} · {formatTimerMs(submission.durationMs)}
    </p>
  );
}

export function FeedbackNote({ submission }: { submission: PracticeSubmission }) {
  if (!submission.feedback) {
    return null;
  }
  return (
    <div className="rounded-lg bg-bg px-3 py-2 text-sm">
      <p className="text-xs text-muted">
        {submission.status === 'redo_requested' ? 'Pedido para refazer' : 'Comentário do professor'}
      </p>
      <p className="whitespace-pre-wrap text-text">{submission.feedback}</p>
    </div>
  );
}

type PracticeSubmissionReviewProps = {
  organizationId: string;
  userId: string;
  dueAt: string;
  /** Envios do aluno, da tentativa mais recente para a mais antiga. */
  submissions: PracticeSubmission[];
  /** Tarefa diária: sem "refazer" (o aluno entrega de novo no dia seguinte). */
  isDaily?: boolean;
  onReviewed: () => void;
};

/** Ouvir o envio mais recente, comentar e revisar (ou pedir para refazer). */
export function PracticeSubmissionReview({
  organizationId,
  userId,
  dueAt,
  submissions,
  isDaily = false,
  onReviewed,
}: PracticeSubmissionReviewProps) {
  const practice = usePractice();
  const latest = submissions[0] ?? null;
  const [feedback, setFeedback] = useState(latest?.feedback ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function review(status: 'reviewed' | 'redo_requested') {
    if (!latest) {
      return;
    }
    setIsSaving(true);
    setError(null);
    const result = await practice.reviewSubmission(organizationId, userId, latest.id, {
      status,
      feedback,
    });
    setIsSaving(false);
    if (!result.ok) {
      setError(practiceErrorMessage(result.error));
      return;
    }
    onReviewed();
  }

  if (!latest) {
    return null;
  }

  return (
    <div className="space-y-3">
      <PracticeSubmissionAudio
        organizationId={organizationId}
        submissionId={latest.id}
        mimeType={latest.mimeType}
      />
      {latest.studentNote ? (
        <div className="text-sm">
          <p className="text-xs text-muted">Recado do aluno</p>
          <p className="whitespace-pre-wrap text-text">{latest.studentNote}</p>
        </div>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Comentário</span>
        <textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Ex.: Aos 0:42, cuidado com a afinação do Fá#."
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
        />
      </label>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {!isDaily ? (
          <button
            type="button"
            onClick={() => void review('redo_requested')}
            disabled={isSaving}
            className={inCardButtonClass}
          >
            Pedir para refazer
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void review('reviewed')}
          disabled={isSaving}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {latest.status === 'reviewed' ? 'Atualizar comentário' : 'Marcar como revisada'}
        </button>
      </div>
      {submissions.length > 1 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">
            {isDaily ? 'Entregas anteriores' : 'Tentativas anteriores'}
          </summary>
          <ul className="mt-2 space-y-3">
            {submissions.slice(1).map((submission) => (
              <li key={submission.id} className="space-y-1">
                <SubmissionMeta submission={submission} dueAt={dueAt} />
                <PracticeSubmissionAudio
                  organizationId={organizationId}
                  submissionId={submission.id}
                  mimeType={submission.mimeType}
                />
                <FeedbackNote submission={submission} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
