import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PracticeTaskDetail } from '@/application/practice';
import { practiceTaskReferenceStartPage } from '@/domain/practice';
import { Modal } from '@/ui/components/Modal';
import {
  IconChevronDown,
  IconClipboardCheck,
  IconList,
  IconPlus,
  IconReturn,
  IconUpload,
  IconX,
} from '@/ui/components/icons';
import {
  PdfViewerRecordButton,
  PdfViewerRecorderActiveControls,
  PdfViewerRecordingsModal,
} from '@/ui/features/repertoire/PdfViewerRecorderBar';
import {
  usePdfViewerRecorderStart,
  usePdfViewerRecorderSurface,
  type PdfViewerRecordingContext,
} from '@/ui/features/repertoire/pdf-viewer-recorder-hooks';
import { useStudyRecordingSession } from '@/ui/features/study-tools/recording-session/recording-session-context';
import { useStudyRecordings } from '@/ui/features/study-tools/useStudyRecordings';
import { PracticeStatusBadge } from '@/ui/features/practice/PracticeStatusBadge';
import { SubmitPracticeRecordingModal } from '@/ui/features/practice/SubmitPracticeRecordingModal';
import { usePracticeTaskTakes } from '@/ui/features/practice/PracticeTaskAttempt';
import { formatPracticeTaskSchedule } from '@/ui/features/practice/practice-labels';
import { practiceTaskPath } from '@/ui/features/practice/practice-routes';
import {
  buildReaderTaskView,
  type ReaderTaskFilter,
  type ReaderTaskOption as ReaderPracticeTaskOption,
} from '@/ui/features/practice/reader-task-groups';
import type { ReaderTaskListStatus } from '@/ui/features/practice/useReaderPracticeTasks';

const toolbarButtonClass = (active: boolean) =>
  `relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm ${
    active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text'
  }`;

const barButtonClass =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text shadow-sm';

type ReaderPracticeTasksButtonProps = {
  options: ReaderPracticeTaskOption[];
  listStatus: ReaderTaskListStatus;
  canCreate: boolean;
  activeTaskId: string | null;
  currentPage: number;
  onSelect: (taskId: string) => void;
  onRetry: () => void;
  /** Abre o formulário no próprio leitor, já apontando para a página atual. */
  onNewTask: () => void;
};

/** A busca só aparece quando a lista começa a ficar longa. */
const SEARCH_THRESHOLD = 8;

const FILTER_LABEL: Record<ReaderTaskFilter, string> = {
  page: 'Nesta página',
  review: 'Para ouvir',
  all: 'Todas',
};

function TaskRow({
  option,
  active,
  onSelect,
}: {
  option: ReaderPracticeTaskOption;
  active: boolean;
  onSelect: () => void;
}) {
  const isManager = option.role === 'manager';
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left ${
          active ? 'border-primary bg-primary/5' : 'border-border bg-bg'
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-text">{option.title}</span>
          <span className="block truncate text-xs text-muted">
            {/* Quem passou vê por trecho (o grupo já diz onde): interessa a turma. A lista do aluno é plana. */}
            {isManager
              ? option.audienceLabel
                ? `${option.audienceLabel} · `
                : ''
              : `${option.locationLabel} · `}
            {option.scheduleLabel}
          </span>
        </span>
        {isManager ? (
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            {option.toReview ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                {option.toReview} para ouvir
              </span>
            ) : null}
            <span className="text-xs text-muted tabular-nums">
              {option.delivered ?? 0}/{option.students ?? 0} entregaram
            </span>
          </span>
        ) : option.studentStatus ? (
          <PracticeStatusBadge status={option.studentStatus} />
        ) : null}
      </button>
    </li>
  );
}

/** Botão da barra do leitor: tarefas ligadas a esta partitura, por trecho. */
export function ReaderPracticeTasksButton({
  options,
  listStatus,
  canCreate,
  activeTaskId,
  currentPage,
  onSelect,
  onRetry,
  onNewTask,
}: ReaderPracticeTasksButtonProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<ReaderTaskFilter>('page');
  const [query, setQuery] = useState('');
  /** Grupos que a pessoa abriu ou fechou à mão (o padrão depende do filtro). */
  const [toggled, setToggled] = useState<Set<string>>(() => new Set());

  const view = useMemo(
    () => buildReaderTaskView({ options, filter, query, currentPage }),
    [currentPage, filter, options, query],
  );

  function select(taskId: string) {
    onSelect(taskId);
    setOpen(false);
  }

  function isExpanded(groupKey: string, isCurrent: boolean) {
    const byDefault = filter !== 'all' || query.trim() !== '' || isCurrent;
    return toggled.has(groupKey) ? !byDefault : byDefault;
  }

  function toggleGroup(groupKey: string) {
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  const reviewTotal = options.reduce((sum, option) => sum + (option.toReview ?? 0), 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          view.attentionCount > 0
            ? `Tarefas desta partitura (${view.attentionCount} pedem atenção)`
            : 'Tarefas desta partitura'
        }
        title="Tarefas"
        className={toolbarButtonClass(activeTaskId !== null)}
      >
        <IconClipboardCheck className="h-4 w-4" />
        {view.attentionCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-white">
            {view.attentionCount}
          </span>
        ) : null}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Tarefas desta partitura">
        <div className="space-y-5">
          {canCreate && listStatus === 'ready' ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNewTask();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white"
            >
              <IconPlus className="h-4 w-4" />
              Nova tarefa na página {currentPage}
            </button>
          ) : null}

          {listStatus !== 'ready' ? (
            <div className="rounded-lg border border-border bg-bg px-4 py-3 text-sm text-muted">
              {listStatus === 'loading' ? (
                <p>Carregando tarefas…</p>
              ) : listStatus === 'offline' ? (
                <p>Sem conexão. As tarefas aparecem quando a internet voltar.</p>
              ) : (
                <>
                  <p>Não foi possível carregar as tarefas.</p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text shadow-sm"
                  >
                    Tentar de novo
                  </button>
                </>
              )}
            </div>
          ) : options.length === 0 ? (
            <p className="rounded-lg border border-border bg-bg px-4 py-3 text-sm text-muted">
              {canCreate
                ? 'Nenhuma tarefa nesta partitura ainda.'
                : 'Nenhuma tarefa para você nesta partitura.'}
            </p>
          ) : null}
          {view.mine.length > 0 ? (
            <section className="space-y-2">
              {view.totalManaged > 0 ? (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Para mim</h3>
              ) : null}
              <ul className="space-y-2">
                {view.mine.map((option) => (
                  <TaskRow
                    key={option.taskId}
                    option={option}
                    active={option.taskId === activeTaskId}
                    onSelect={() => select(option.taskId)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {view.totalManaged > 0 ? (
            <section className="space-y-3">
              {view.mine.length > 0 ? (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Que passei</h3>
              ) : null}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar tarefas">
                {(['page', 'review', 'all'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      filter === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-text'
                    }`}
                  >
                    {FILTER_LABEL[value]}
                    {value === 'review' && reviewTotal > 0 ? ` (${reviewTotal})` : ''}
                  </button>
                ))}
              </div>
              {view.totalManaged >= SEARCH_THRESHOLD ? (
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar aluno, turma ou tarefa"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                />
              ) : null}

              {view.groups.length === 0 ? (
                <div className="text-sm text-muted">
                  <p>
                    {query.trim()
                      ? 'Nenhuma tarefa encontrada.'
                      : filter === 'review'
                        ? 'Nenhuma gravação esperando para ser ouvida.'
                        : 'Nenhuma tarefa neste trecho.'}
                  </p>
                  {filter !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => setFilter('all')}
                      className="mt-1 font-medium text-primary hover:underline"
                    >
                      Ver todas
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {view.groups.map((group) => {
                    const expanded = isExpanded(group.key, group.isCurrent);
                    return (
                      <div key={group.key}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          aria-expanded={expanded}
                          className="flex w-full items-center justify-between gap-2 py-1 text-left"
                        >
                          <span className="min-w-0 truncate text-sm font-semibold text-text">
                            {group.label}
                            {group.isCurrent && group.startPage !== null ? (
                              <span className="ml-1.5 text-xs font-normal text-primary">
                                você está aqui
                              </span>
                            ) : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                            {group.items.length} {group.items.length === 1 ? 'tarefa' : 'tarefas'}
                            {group.toReview > 0 ? ` · ${group.toReview} para ouvir` : ''}
                            <IconChevronDown
                              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                              aria-hidden
                            />
                          </span>
                        </button>
                        {expanded ? (
                          <ul className="mt-1 space-y-2">
                            {group.items.map((option) => (
                              <TaskRow
                                key={option.taskId}
                                option={option}
                                active={option.taskId === activeTaskId}
                                onSelect={() => select(option.taskId)}
                              />
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

type ReaderPracticeTaskBarProps = {
  orgSlug: string;
  organizationId: string;
  userId: string;
  pieceFileId: string;
  detail: PracticeTaskDetail;
  /** Gravação nesta faixa (no lugar da barra do gravador do leitor). */
  recordingContext: PdfViewerRecordingContext | null;
  getCurrentPage: () => number;
  onGoToPage: (page: number) => void;
  onClose: () => void;
  onSubmitted: () => void;
};

/** Gravador embutido na faixa: some a barra própria do leitor (economiza uma linha). */
function TaskBarRecorderSurface() {
  usePdfViewerRecorderSurface();
  return null;
}

/** Faixa da tarefa em foco, logo abaixo da barra de ferramentas do leitor (uma linha). */
export function ReaderPracticeTaskBar({
  orgSlug,
  organizationId,
  userId,
  pieceFileId,
  detail,
  recordingContext,
  getCurrentPage,
  onGoToPage,
  onClose,
  onSubmitted,
}: ReaderPracticeTaskBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const recording = useStudyRecordingSession();
  const { task, mine, canManage, students } = detail;

  const fallbackContext: PdfViewerRecordingContext = {
    organizationId,
    pieceId: '',
    pieceFileId,
  };
  // Gravação do aluno com a tarefa em foco: pertence à tarefa e pode ser enviada.
  const canSubmit = mine?.progress.canSubmit ?? false;
  /** Aluno numa tarefa que não aceita mais envio (revisada, encerrada, prazo): sem gravar. */
  const submissionClosed = mine !== null && !canSubmit;
  const practiceTask = useMemo(
    () => (canSubmit ? { id: task.id, title: task.title } : null),
    [canSubmit, task.id, task.title],
  );
  const startRecording = usePdfViewerRecorderStart(
    recordingContext ?? fallbackContext,
    userId,
    getCurrentPage,
    practiceTask,
  );
  const { takes } = usePracticeTaskTakes(organizationId, userId, task);
  // Acabou de salvar uma gravação desta tarefa: já oferece o envio.
  const takeCountRef = useRef<number | null>(null);
  useEffect(() => {
    const previous = takeCountRef.current;
    takeCountRef.current = takes.length;
    if (mine?.progress.canSubmit && previous !== null && takes.length > previous) {
      setSubmitOpen(true);
    }
  }, [mine?.progress.canSubmit, takes.length]);
  const { recordings } = useStudyRecordings({ organizationId, userId, pieceFileId });

  const referencePage =
    task.reference.kind === 'file' && task.reference.pieceFileId === pieceFileId
      ? practiceTaskReferenceStartPage(task.reference)
      : null;
  const latest = mine?.progress.latestSubmission ?? null;
  const toReview = students.filter((row) => row.progress.status === 'submitted').length;
  const isRecording = recording.isSessionActive || recording.status === 'saving';
  const canRecordHere = recordingContext !== null;

  const expandButton = (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      aria-expanded={expanded}
      aria-label={expanded ? 'Recolher detalhes da tarefa' : 'Ver detalhes da tarefa'}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:text-text"
    >
      <IconChevronDown
        className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
        aria-hidden
      />
    </button>
  );

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      aria-label="Fechar tarefa"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:text-text"
    >
      <IconX className="h-4 w-4" />
    </button>
  );

  return (
    <div className="border-t border-border bg-primary/5 px-3 py-1.5">
      {canRecordHere ? <TaskBarRecorderSurface /> : null}
      <div className="flex items-center gap-2">
        {isRecording && canRecordHere ? (
          <div className="flex min-w-0 flex-1 items-center">
            <PdfViewerRecorderActiveControls />
          </div>
        ) : (
          <>
            <IconClipboardCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
            >
              <span className="truncate text-sm font-medium text-text">{task.title}</span>
              <span className="hidden shrink-0 text-xs text-muted sm:inline">
                {formatPracticeTaskSchedule(task)}
              </span>
            </button>
            {/* Sem envio possível, o status ocupa o lugar do botão de gravar e explica o porquê. */}
            {submissionClosed ? (
              <PracticeStatusBadge status={mine.progress.status} />
            ) : (
              <>
                {mine ? (
                  <span className="max-sm:hidden">
                    <PracticeStatusBadge status={mine.progress.status} />
                  </span>
                ) : null}
                {canRecordHere ? (
                  <PdfViewerRecordButton onStart={startRecording} compactLabel />
                ) : null}
              </>
            )}
            {mine?.progress.canSubmit ? (
              <button
                type="button"
                onClick={() => setSubmitOpen(true)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-medium text-white"
              >
                <IconUpload className="h-4 w-4" aria-hidden />
                Enviar
                {takes.length > 0 ? <span className="tabular-nums">({takes.length})</span> : null}
              </button>
            ) : null}
            {canManage ? (
              <Link to={practiceTaskPath(orgSlug, task.id)} className={barButtonClass}>
                {toReview > 0 ? `${toReview} para ouvir` : 'Entregas'}
              </Link>
            ) : null}
          </>
        )}
        {expandButton}
        {closeButton}
      </div>

      {expanded ? (
        <div className="space-y-2 pb-1 pt-2 text-sm">
          <p className="text-xs text-muted">
            {formatPracticeTaskSchedule(task)}
            {task.closedAt ? ' · Encerrada' : ''}
          </p>
          {mine && !submissionClosed ? (
            <div className="sm:hidden">
              <PracticeStatusBadge status={mine.progress.status} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {referencePage !== null ? (
              <button
                type="button"
                onClick={() => onGoToPage(referencePage)}
                className={barButtonClass}
              >
                <IconReturn className="h-4 w-4" aria-hidden />
                Voltar ao trecho
              </button>
            ) : null}
            {canRecordHere && recordings.length > 0 ? (
              <button
                type="button"
                onClick={() => setRecordingsOpen(true)}
                className={barButtonClass}
              >
                <IconList className="h-4 w-4" aria-hidden />
                <span className="tabular-nums">{recordings.length}</span>
                {recordings.length === 1 ? 'gravação' : 'gravações'} nesta partitura
              </button>
            ) : null}
          </div>
          {task.instructions ? (
            <p className="whitespace-pre-wrap text-text">{task.instructions}</p>
          ) : (
            <p className="text-muted">Sem instruções.</p>
          )}
          {submissionClosed ? (
            <p className="text-xs text-muted">
              {mine?.progress.blockedReason === 'not_today'
                ? 'Hoje não é dia de entrega.'
                : 'Não é possível enviar novas respostas.'}
            </p>
          ) : null}
          {latest?.feedback ? (
            <div className="rounded-lg bg-surface px-3 py-2">
              <p className="text-xs text-muted">
                {latest.status === 'redo_requested' ? 'Pedido para refazer' : 'Comentário do professor'}
              </p>
              <p className="whitespace-pre-wrap text-text">{latest.feedback}</p>
            </div>
          ) : null}
          {/* O professor já tem "Entregas" na faixa; o aluno chega ao histórico por aqui. */}
          {!canManage ? (
            <Link
              to={practiceTaskPath(orgSlug, task.id)}
              className="inline-block text-xs font-medium text-primary hover:underline"
            >
              Abrir página da tarefa
            </Link>
          ) : null}
        </div>
      ) : null}

      {mine ? (
        <SubmitPracticeRecordingModal
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
          organizationId={organizationId}
          userId={userId}
          task={task}
          onSubmitted={onSubmitted}
        />
      ) : null}
      {recordingContext ? (
        <PdfViewerRecordingsModal
          open={recordingsOpen}
          onClose={() => setRecordingsOpen(false)}
          context={recordingContext}
          userId={userId}
        />
      ) : null}
    </div>
  );
}
