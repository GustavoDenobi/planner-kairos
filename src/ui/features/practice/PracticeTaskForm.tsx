import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AssociableAudience } from '@/application/agenda/list-associable-audience';
import type { EventListItem } from '@/domain/agenda';
import type {
  PracticeTask,
  PracticeTaskCadence,
  PracticeTaskInput,
  PracticeTaskReference,
  PracticeTaskReferenceInput,
} from '@/domain/practice';
import { PRACTICE_DAILY_ALL_WEEKDAYS } from '@/domain/practice';
import type { PieceDetail } from '@/domain/repertoire';
import { useAgenda, usePractice } from '@/ui/app/AppServicesContext';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { AudienceFields } from '@/ui/features/audience';
import {
  addDays,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/ui/features/agenda/agenda-date';
import { PracticeReferenceField } from '@/ui/features/practice/PracticeReferenceField';
import { usePracticeScoreAccessWarning } from '@/ui/features/practice/usePracticeScoreAccessWarning';
import { eventShortLabel, findNextEventForAudience } from '@/ui/features/practice/next-event';
import {
  WEEKDAY_PICKER,
  defaultPracticeDueAt,
  formatPracticeDueAt,
  practiceErrorMessage,
} from '@/ui/features/practice/practice-labels';
import type { PracticeTaskPrefill } from '@/ui/features/practice/practice-routes';

const fieldClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text disabled:opacity-60';

const sectionTitleClass = 'text-sm font-semibold text-text';

/** Data local (AAAA-MM-DD) de um valor de datetime-local, ou de hoje. */
function localDatePart(datetimeLocal: string): string {
  if (datetimeLocal.length >= 10) {
    return datetimeLocal.slice(0, 10);
  }
  return todayLocalDate();
}

function todayLocalDate(): string {
  return toDatetimeLocalValue(new Date().toISOString()).slice(0, 10);
}

const segmentClass = (active: boolean) =>
  `flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
    active ? 'bg-primary text-white shadow-sm' : 'text-text hover:bg-bg'
  }`;

/** Referência gravada → valor editável no formulário. */
function referenceToInput(reference: PracticeTaskReference): PracticeTaskReferenceInput {
  if (reference.kind !== 'file') {
    return reference;
  }
  const location = reference.location;
  if (location.kind === 'toc') {
    return {
      ...reference,
      location: location.tocEntryId
        ? { kind: 'toc', tocEntryId: location.tocEntryId }
        : { kind: 'point', page: location.page, x: location.x, y: location.y },
    };
  }
  return { ...reference, location };
}

type DueSuggestion = { event: EventListItem } | null;

type PracticeTaskFormProps = {
  organizationId: string;
  userId: string;
  /** Edição; sem ele, cria uma tarefa nova. */
  taskId?: string | null;
  /** Campos pré-preenchidos de uma tarefa nova (ignorados na edição). */
  prefill?: PracticeTaskPrefill;
  onSaved: (task: PracticeTask) => void;
  onCancel: () => void;
};

const EMPTY_PREFILL: PracticeTaskPrefill = {};

/** Formulário de tarefa: usado na página própria e no leitor de partituras (em modal). */
export function PracticeTaskForm({
  organizationId,
  userId,
  taskId = null,
  prefill = EMPTY_PREFILL,
  onSaved,
  onCancel,
}: PracticeTaskFormProps) {
  const practice = usePractice();
  const agenda = useAgenda();
  const isEdit = Boolean(taskId);

  const [audience, setAudience] = useState<AssociableAudience | null>(null);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [existing, setExisting] = useState<PracticeTask | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('practice-task-form', isLoading);

  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [musicianIds, setMusicianIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [reference, setReference] = useState<PracticeTaskReferenceInput>({
    kind: 'none',
  });
  const [dueAtLocal, setDueAtLocal] = useState(() =>
    toDatetimeLocalValue(defaultPracticeDueAt().toISOString()),
  );
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);
  const [acceptLate, setAcceptLate] = useState(true);
  const [cadence, setCadence] = useState<PracticeTaskCadence>('once');
  const [startsOn, setStartsOn] = useState(todayLocalDate);
  /** Vazio: acompanha o prazo sugerido até o usuário escolher. */
  const [endsOn, setEndsOn] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([...PRACTICE_DAILY_ALL_WEEKDAYS]);
  /** Enquanto o usuário não mexer no prazo, ele acompanha o próximo encontro do público. */
  const dueTouchedRef = useRef(false);
  const [dueSuggestion, setDueSuggestion] = useState<DueSuggestion>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [piece, setPiece] = useState<PieceDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const now = new Date();
      const [audienceResult, eventsResult, taskResult] = await Promise.all([
        agenda.listAssociableAudience(organizationId, userId),
        agenda.listEventsInRange(organizationId, userId, {
          from: now.toISOString(),
          to: addDays(now, 28).toISOString(),
        }),
        taskId ? practice.getTask(organizationId, userId, taskId) : Promise.resolve(null),
      ]);
      if (cancelled) {
        return;
      }

      if (!audienceResult.ok) {
        setLoadError(practiceErrorMessage(audienceResult.error));
        setIsLoading(false);
        return;
      }
      setAudience(audienceResult.value);
      setEvents(eventsResult.ok ? eventsResult.value : []);

      if (taskResult) {
        if (!taskResult.ok) {
          setLoadError(practiceErrorMessage(taskResult.error));
          setIsLoading(false);
          return;
        }
        if (!taskResult.value.canManage) {
          setLoadError(practiceErrorMessage('not_allowed'));
          setIsLoading(false);
          return;
        }
        const task = taskResult.value.task;
        setExisting(task);
        setGroupIds(task.groups.map((group) => group.id));
        setMusicianIds(task.musicians.map((musician) => musician.id));
        setTitle(task.title);
        setInstructions(task.instructions);
        setReference(referenceToInput(task.reference));
        setDueAtLocal(toDatetimeLocalValue(task.dueAt));
        setLinkedEventId(task.linkedEventId);
        setAcceptLate(task.acceptLateSubmissions);
        setCadence(task.cadence);
        if (task.daily) {
          setStartsOn(task.daily.startsOn);
          setEndsOn(task.daily.endsOn);
          setWeekdays(task.daily.weekdays);
        }
        dueTouchedRef.current = true;
      } else {
        const available = audienceResult.value;
        const groupSet = new Set(available.groups.map((group) => group.id));
        const musicianSet = new Set(
          available.musicians
            .map((musician) => musician.id)
            .filter((id) => id !== available.myMusicianId),
        );
        const wantedGroups = [
          ...(prefill.groupIds ?? []),
          ...(prefill.groupId ? [prefill.groupId] : []),
        ];
        const wantedMusicians = [
          ...(prefill.musicianIds ?? []),
          ...(prefill.musicianId ? [prefill.musicianId] : []),
        ];
        setGroupIds([...new Set(wantedGroups.filter((id) => groupSet.has(id)))]);
        setMusicianIds([...new Set(wantedMusicians.filter((id) => musicianSet.has(id)))]);
        if (prefill.pieceId && prefill.fileId) {
          setReference({
            kind: 'file',
            pieceId: prefill.pieceId,
            pieceFileId: prefill.fileId,
            location: prefill.page ? { kind: 'point', page: prefill.page } : { kind: 'whole_file' },
          });
        } else if (prefill.pieceId) {
          setReference({ kind: 'piece', pieceId: prefill.pieceId });
        }
        if (prefill.eventId) {
          const event = (eventsResult.ok ? eventsResult.value : []).find(
            (item) => item.id === prefill.eventId,
          );
          if (event) {
            setGroupIds(
              event.groups
                .map((group) => group.id)
                .filter((id) => available.groups.some((group) => group.id === id)),
            );
            setMusicianIds(
              event.musicians
                .map((musician) => musician.id)
                .filter(
                  (id) =>
                    id !== available.myMusicianId &&
                    available.musicians.some((musician) => musician.id === id),
                ),
            );
            setDueAtLocal(toDatetimeLocalValue(event.startsAt));
            setLinkedEventId(event.id);
            setDueSuggestion({ event });
            dueTouchedRef.current = true;
          }
        }
      }
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [agenda, organizationId, practice, prefill, taskId, userId]);

  // Prazo padrão: próximo encontro do público escolhido.
  useEffect(() => {
    if (dueTouchedRef.current) {
      return;
    }
    // Tarefa passada durante um encontro: o prazo é o encontro seguinte, não o atual.
    const now = new Date();
    const after = prefill.nextAfter ? new Date(prefill.nextAfter) : null;
    const from = after && after.getTime() > now.getTime() ? after : now;
    const next = findNextEventForAudience(events, { groupIds, musicianIds }, from);
    setDueSuggestion(next ? { event: next } : null);
    setLinkedEventId(next?.id ?? null);
    setDueAtLocal(
      toDatetimeLocalValue(next ? next.startsAt : defaultPracticeDueAt().toISOString()),
    );
  }, [events, groupIds, musicianIds, prefill.nextAfter]);

  const musicianOptions = useMemo(
    () => (audience?.musicians ?? []).filter((musician) => musician.id !== audience?.myMusicianId),
    [audience],
  );
  const handlePieceChange = useCallback((next: PieceDetail | null) => {
    setPiece(next);
  }, []);
  const namedMusicians = useMemo(() => {
    const byId = new Map<string, string>();
    for (const musician of musicianOptions) {
      byId.set(musician.id, musician.name);
    }
    for (const musician of existing?.musicians ?? []) {
      byId.set(musician.id, musician.name);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [existing, musicianOptions]);
  const blockedMusicians = usePracticeScoreAccessWarning({
    organizationId,
    groupIds,
    musicianIds,
    musicians: namedMusicians,
    piece,
    pieceFileId: reference.kind === 'file' ? reference.pieceFileId : null,
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    setIsSaving(true);

    const isDaily = cadence === 'daily';
    const lastDay = endsOn || localDatePart(dueAtLocal);
    const input: PracticeTaskInput = {
      title,
      instructions,
      reference,
      cadence,
      daily: isDaily ? { startsOn, endsOn: lastDay, weekdays } : null,
      // Na diária é só uma estimativa: o banco usa o fim do último dia no fuso da organização.
      dueAt: isDaily
        ? fromDatetimeLocalValue(`${lastDay}T23:59`)
        : dueAtLocal
          ? fromDatetimeLocalValue(dueAtLocal)
          : '',
      acceptLateSubmissions: acceptLate,
      linkedEventId: isDaily ? null : linkedEventId,
      groupIds,
      musicianIds,
    };
    const result = existing
      ? await practice.updateTask(organizationId, userId, existing.id, input)
      : await practice.createTask(organizationId, userId, input);

    setIsSaving(false);
    if (!result.ok) {
      setSaveError(practiceErrorMessage(result.error));
      return;
    }
    onSaved(result.value);
  }

  if (loadError) {
    return <p className="text-sm text-muted">{loadError}</p>;
  }

  const canCreate = audience ? audience.isPrivileged || audience.isGroupWriter : true;
  if (!isLoading && !canCreate) {
    return (
      <p className="text-sm text-muted">
        Só administradores, professores e regentes podem passar tarefas.
      </p>
    );
  }

  const disabled = isLoading || isSaving;
  const linkedEvent = dueSuggestion?.event ?? null;
  const dueMatchesEvent =
    linkedEvent !== null && dueAtLocal === toDatetimeLocalValue(linkedEvent.startsAt);

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
      <section className="space-y-2">
        <h2 className={sectionTitleClass}>Para quem</h2>
        <AudienceFields
          groups={audience?.groups ?? []}
          musicians={musicianOptions}
          selectedGroupIds={groupIds}
          selectedMusicianIds={musicianIds}
          onGroupIdsChange={setGroupIds}
          onMusicianIdsChange={setMusicianIds}
          disabled={disabled}
          title=""
          searchPlaceholder="Buscar aluno, turma ou grupo"
          emptySelectedLabel="Ninguém escolhido ainda."
        />
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleClass}>O que fazer</h2>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Título</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex.: Escala de Sol maior, 2 oitavas"
            maxLength={160}
            disabled={disabled}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Instruções (opcional)</span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="O que o aluno deve gravar e no que prestar atenção."
            rows={4}
            maxLength={4000}
            disabled={disabled}
            className={fieldClass}
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className={sectionTitleClass}>Partitura (opcional)</h2>
        <PracticeReferenceField
          organizationId={organizationId}
          value={reference}
          onChange={setReference}
          onPieceChange={handlePieceChange}
          disabled={disabled}
        />
        {blockedMusicians.length > 0 ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
            <p>Os seguintes músicos não têm acesso a esta partitura</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {blockedMusicians.map((musician) => (
                <li key={musician.musicianId}>{musician.musicianName}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className={sectionTitleClass}>Entrega</h2>
        <div
          role="radiogroup"
          aria-label="Frequência da entrega"
          className="flex rounded-lg border border-border bg-surface p-1 sm:w-80"
        >
          {(
            [
              ['once', 'Uma vez'],
              ['daily', 'Diário'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={cadence === value}
              onClick={() => setCadence(value)}
              disabled={disabled}
              className={segmentClass(cadence === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {cadence === 'daily' ? (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Primeiro dia</span>
              <input
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
                disabled={disabled}
                className={`${fieldClass} sm:w-auto`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Último dia</span>
              <input
                type="date"
                value={endsOn || localDatePart(dueAtLocal)}
                min={startsOn}
                onChange={(event) => setEndsOn(event.target.value)}
                disabled={disabled}
                className={`${fieldClass} sm:w-auto`}
              />
            </label>
          </div>
          <div>
            <span className="mb-1 block text-sm text-muted">Dias de entrega</span>
            <div className="flex gap-1">
              {WEEKDAY_PICKER.map((day) => {
                const active = weekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={active}
                    aria-label={day.label}
                    title={day.label}
                    onClick={() =>
                      setWeekdays((current) =>
                        active
                          ? current.filter((value) => value !== day.value)
                          : [...current, day.value],
                      )
                    }
                    disabled={disabled}
                    className={`h-9 w-9 rounded-lg text-sm font-medium shadow-sm ${
                      active
                        ? 'bg-primary text-white'
                        : 'border border-border bg-surface text-muted'
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted">
            O aluno deverá enviar uma gravação em cada dia selecionado.
          </p>
        </section>
      ) : (
        <section className="space-y-2">
          <h2 className={sectionTitleClass}>Até quando</h2>
          <input
            type="datetime-local"
            value={dueAtLocal}
            onChange={(event) => {
              dueTouchedRef.current = true;
              setDueAtLocal(event.target.value);
              const matches =
                linkedEvent !== null &&
                event.target.value === toDatetimeLocalValue(linkedEvent.startsAt);
              setLinkedEventId(matches ? linkedEvent.id : null);
            }}
            disabled={disabled}
            className={`${fieldClass} sm:w-auto`}
          />
          <p className="text-xs text-muted">
            {dueMatchesEvent && linkedEvent
              ? `Até o encontro "${eventShortLabel(linkedEvent)}" de ${formatPracticeDueAt(linkedEvent.startsAt)}.`
              : groupIds.length + musicianIds.length > 0 && !dueTouchedRef.current
                ? 'Nenhum encontro desse público nas próximas semanas; prazo de uma semana.'
                : null}
          </p>
          <label className="flex items-start gap-2 pt-1 text-sm text-text">
            <input
              type="checkbox"
              checked={acceptLate}
              onChange={(event) => setAcceptLate(event.target.checked)}
              disabled={disabled}
              className="mt-0.5"
            />
            <span>
              Aceitar envios depois do prazo
              <span className="block text-xs text-muted">
                {acceptLate
                  ? 'Envios atrasados ficam marcados como "depois do prazo".'
                  : 'Depois do prazo, só quem recebeu um pedido para refazer pode enviar.'}
              </span>
            </span>
          </label>
        </section>
      )}

      {saveError ? <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text shadow-sm hover:bg-bg"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSaving ? 'Salvando…' : isEdit ? 'Salvar' : 'Passar tarefa'}
        </button>
      </div>
    </form>
  );
}
