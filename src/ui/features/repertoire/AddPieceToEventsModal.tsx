import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  canWriteEvent,
  eventDisplayTitle,
  findEventsWithSamePieceEntry,
  isEventCancelled,
  type AppendPieceToEventResult,
  type EventListItem,
  type PieceProgramEntry,
  type ProgramItemUnitInput,
} from '@/domain/agenda';
import type {
  PdfNavigationShortcut,
  PieceDetail,
  PieceFileTocEntry,
  PieceFileWithLinks,
} from '@/domain/repertoire';
import type { AssociableAudience } from '@/application/agenda';
import { useAgenda, useRepertoire } from '@/ui/app/AppServicesContext';
import { Modal } from '@/ui/components/Modal';
import { MultiSelectDropdown } from '@/ui/components/MultiSelectDropdown';
import { IconAlertTriangle, IconCheck } from '@/ui/components/icons';
import { EventProgramUnitsEditor } from '@/ui/features/agenda/EventProgramUnitsEditor';
import { agendaErrorMessage } from '@/ui/features/agenda/agenda-labels';
import { formatEventScheduleLabel } from '@/ui/features/agenda/agenda-date';
import { eventPath } from '@/ui/features/agenda/agenda-routes';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';

const RANGE_DAYS = 60;
const MAX_EVENTS_PER_SUBMIT = 100;

type AddPieceToEventsModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  orgSlug: string;
  userId: string;
  isAdmin: boolean;
  piece: Pick<PieceDetail, 'id' | 'title' | 'fileOrganization' | 'files'>;
};

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function unitSummary(
  unit: ProgramItemUnitInput,
  filesById: Map<string, PieceFileWithLinks>,
  tocById: Map<string, PieceFileTocEntry>,
  shortcutsById: Map<string, PdfNavigationShortcut>,
): string {
  const fileTitle = filesById.get(unit.pieceFileId)?.title ?? 'Partitura';
  if (unit.pieceFileTocEntryId) {
    return unit.label?.trim() || tocById.get(unit.pieceFileTocEntryId)?.label || fileTitle;
  }
  const title = unit.label?.trim() || fileTitle;
  if (unit.navigationShortcutId) {
    const shortcut = shortcutsById.get(unit.navigationShortcutId);
    return shortcut ? `${title} (${shortcut.label})` : title;
  }
  if (unit.startPage != null || unit.endPage != null) {
    const pages =
      unit.startPage != null && unit.endPage != null && unit.startPage !== unit.endPage
        ? `p. ${unit.startPage}–${unit.endPage}`
        : `p. ${unit.startPage ?? unit.endPage}`;
    return `${title} (${pages})`;
  }
  return `${title} (completo)`;
}

const RESULT_LABELS: Record<AppendPieceToEventResult['status'], string> = {
  added: 'Adicionada',
  not_found: 'Evento não encontrado',
  cancelled: 'Evento cancelado',
  forbidden: 'Sem permissão',
};

export function AddPieceToEventsModal({
  open,
  onClose,
  organizationId,
  orgSlug,
  userId,
  isAdmin,
  piece,
}: AddPieceToEventsModalProps) {
  const agenda = useAgenda();
  const repertoire = useRepertoire();

  const [audience, setAudience] = useState<AssociableAudience | null>(null);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [entries, setEntries] = useState<PieceProgramEntry[]>([]);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [units, setUnits] = useState<ProgramItemUnitInput[]>([]);

  const [scoreFiles, setScoreFiles] = useState<PieceFileWithLinks[]>([]);
  const [shortcutsByFileId, setShortcutsByFileId] = useState<Map<string, PdfNavigationShortcut[]>>(
    new Map(),
  );
  const [tocEntriesByFileId, setTocEntriesByFileId] = useState<Map<string, PieceFileTocEntry[]>>(
    new Map(),
  );
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [unitsEditorOpen, setUnitsEditorOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [results, setResults] = useState<AppendPieceToEventResult[] | null>(null);

  const isWritable = useCallback(
    (event: EventListItem, currentAudience: AssociableAudience | null) =>
      canWriteEvent({
        isPrivileged: isAdmin,
        isGroupWriter: Boolean(currentAudience?.isGroupWriter),
        userId,
        createdBy: event.createdBy,
        eventGroupIds: event.groups.map((group) => group.id),
        writableGroupIds: currentAudience?.writableGroupIds ?? [],
      }),
    [isAdmin, userId],
  );

  const loadRange = useCallback(
    async (from: Date, to: Date, currentAudience: AssociableAudience | null) => {
      setIsLoadingEvents(true);
      setLoadError(null);
      const eventsResult = await agenda.listEventsInRange(organizationId, userId, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      if (!eventsResult.ok) {
        setIsLoadingEvents(false);
        setLoadError(agendaErrorMessage(eventsResult.error));
        return false;
      }

      const now = Date.now();
      const nextEvents = eventsResult.value.filter(
        (event) =>
          new Date(event.startsAt).getTime() >= now &&
          !isEventCancelled(event) &&
          isWritable(event, currentAudience),
      );

      const entriesResult = await agenda.listPieceProgramEntries(
        organizationId,
        piece.id,
        nextEvents.map((event) => event.id),
      );
      setIsLoadingEvents(false);
      if (!entriesResult.ok) {
        setLoadError(agendaErrorMessage(entriesResult.error));
        return false;
      }

      setEvents((current) => {
        const known = new Set(current.map((event) => event.id));
        return [...current, ...nextEvents.filter((event) => !known.has(event.id))].sort((a, b) =>
          a.startsAt.localeCompare(b.startsAt),
        );
      });
      setEntries((current) => {
        const loadedIds = new Set(nextEvents.map((event) => event.id));
        return [...current.filter((entry) => !loadedIds.has(entry.eventId)), ...entriesResult.value];
      });
      setRangeEnd(to);
      return true;
    },
    [agenda, isWritable, organizationId, piece.id, userId],
  );

  const loadInitial = useCallback(async () => {
    setEvents([]);
    setEntries([]);
    setRangeEnd(null);
    const audienceResult = await agenda.listAssociableAudience(organizationId, userId);
    const currentAudience = audienceResult.ok ? audienceResult.value : null;
    setAudience(currentAudience);
    const now = new Date();
    await loadRange(now, addDays(now, RANGE_DAYS), currentAudience);
  }, [agenda, loadRange, organizationId, userId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedIds(new Set());
    setTypeIds([]);
    setUnits([]);
    setResults(null);
    setSubmitError(null);
    void loadInitial();
    // Recarrega só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function openUnitsEditor() {
    setIsLoadingUnits(true);
    setSubmitError(null);
    const files = piece.files
      .filter((file) => file.kind === 'score')
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, 'pt-BR'));

    const shortcutsMap = new Map<string, PdfNavigationShortcut[]>();
    const tocMap = new Map<string, PieceFileTocEntry[]>();
    await Promise.all(
      files.map(async (file) => {
        const [shortcutsResult, tocResult] = await Promise.all([
          repertoire.listPieceFileNavigationShortcuts(organizationId, file.id),
          repertoire.listPieceFileTocEntries(organizationId, file.id),
        ]);
        if (shortcutsResult.ok) {
          shortcutsMap.set(file.id, shortcutsResult.value);
        }
        if (tocResult.ok) {
          tocMap.set(file.id, tocResult.value);
        }
      }),
    );
    setScoreFiles(files);
    setShortcutsByFileId(shortcutsMap);
    setTocEntriesByFileId(tocMap);
    setIsLoadingUnits(false);
    setUnitsEditorOpen(true);
  }

  const lookups = useMemo(() => {
    const filesById = new Map(piece.files.map((file) => [file.id, file]));
    const tocById = new Map<string, PieceFileTocEntry>();
    for (const list of tocEntriesByFileId.values()) {
      for (const entry of list) {
        tocById.set(entry.id, entry);
      }
    }
    const shortcutsById = new Map<string, PdfNavigationShortcut>();
    for (const list of shortcutsByFileId.values()) {
      for (const shortcut of list) {
        shortcutsById.set(shortcut.id, shortcut);
      }
    }
    return { filesById, tocById, shortcutsById };
  }, [piece.files, shortcutsByFileId, tocEntriesByFileId]);

  const isWholePiece = units.length === 0;
  const duplicateEventIds = useMemo(
    () =>
      findEventsWithSamePieceEntry(entries, units, {
        fullFileIsWholePiece: piece.fileOrganization !== 'sequential',
      }),
    [entries, units, piece.fileOrganization],
  );
  const selectedDuplicates = [...selectedIds].filter((id) => duplicateEventIds.has(id)).length;

  function toggleEvent(eventId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    const result = await agenda.appendPieceToEvents(
      organizationId,
      piece.id,
      [...selectedIds],
      units,
    );
    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(agendaErrorMessage(result.error));
      return;
    }
    setResults(result.value);
  }

  async function handleLoadMore() {
    if (!rangeEnd) {
      return;
    }
    await loadRange(rangeEnd, addDays(rangeEnd, RANGE_DAYS), audience);
  }

  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  const eventTypeOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const event of events) {
      byId.set(event.typeId, event.typeName);
    }
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (typeIds.length === 0) {
      return events;
    }
    const allowed = new Set(typeIds);
    return events.filter((event) => allowed.has(event.typeId));
  }, [events, typeIds]);

  function renderEventLabel(event: EventListItem, extraBadge?: ReactNode) {
    const title = eventDisplayTitle(event, { name: event.typeName });
    const badgeStyle = eventTypeBadgeStyle({
      kind: event.typeKind,
      color: event.typeColor,
      name: event.typeName,
    });
    return (
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-text">{title}</span>
          <span className="block text-xs text-muted">
            {formatEventScheduleLabel(event.startsAt, event.endsAt)}
            {event.groups.length > 0 ? ` · ${event.groups.map((group) => group.name).join(', ')}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={badgeStyle}>
            {event.typeName}
          </span>
          {extraBadge}
        </span>
      </span>
    );
  }

  const addedCount = results?.filter((item) => item.status === 'added').length ?? 0;

  return (
    <>
      <Modal
        open={open && !unitsEditorOpen}
        onClose={() => !isSubmitting && onClose()}
        title={results ? 'Programação atualizada' : 'Adicionar à programação de eventos'}
        size="lg"
      >
        {results ? (
          <div className="space-y-4">
            <p className="text-sm text-text">
              {addedCount === 1
                ? `${piece.title} foi adicionada a 1 evento.`
                : `${piece.title} foi adicionada a ${addedCount} eventos.`}
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {results.map((item) => {
                const event = eventsById.get(item.eventId);
                return (
                  <li
                    key={item.eventId}
                    className="flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                  >
                    {event ? (
                      <Link
                        to={eventPath(orgSlug, item.eventId)}
                        className="flex min-w-0 flex-1 hover:underline"
                      >
                        {renderEventLabel(event)}
                      </Link>
                    ) : (
                      <span className="flex-1 text-muted">Evento</span>
                    )}
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
                        item.status === 'added' ? 'text-green-700 dark:text-green-400' : 'text-red-600'
                      }`}
                    >
                      {item.status === 'added' ? <IconCheck className="h-3.5 w-3.5" /> : null}
                      {RESULT_LABELS[item.status]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-4">
            <section className="space-y-2 rounded-lg border border-border bg-bg p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-text">O que adicionar</h3>
                <div className="flex shrink-0 gap-2">
                  {!isWholePiece && (
                    <button
                      type="button"
                      onClick={() => setUnits([])}
                      className="rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-text shadow-sm hover:bg-border/40"
                    >
                      Obra inteira
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void openUnitsEditor()}
                    disabled={isLoadingUnits}
                    className="rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-primary shadow-sm hover:bg-border/40 disabled:opacity-60"
                  >
                    {isLoadingUnits ? 'Carregando…' : isWholePiece ? 'Escolher trechos' : 'Alterar trechos'}
                  </button>
                </div>
              </div>
              {isWholePiece ? (
                <p className="text-sm text-muted">
                  <span className="font-medium text-text">{piece.title}</span> — obra inteira
                </p>
              ) : (
                <ul className="space-y-0.5 text-sm text-text">
                  {units.map((unit, index) => (
                    <li key={`${unit.pieceFileId}-${index}`}>
                      {unitSummary(unit, lookups.filesById, lookups.tocById, lookups.shortcutsById)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex min-h-0 flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-text">
                  Próximos eventos
                  {selectedIds.size > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted">
                      {selectedIds.size === 1 ? '1 selecionado' : `${selectedIds.size} selecionados`}
                    </span>
                  )}
                </h3>
                <MultiSelectDropdown
                  label="Tipo de evento"
                  options={eventTypeOptions}
                  selected={typeIds}
                  onChange={setTypeIds}
                  allLabel="Todos os tipos"
                  pluralLabel={(count) => `${count} tipos`}
                  className="w-full sm:w-56"
                />
              </div>

              {loadError ? (
                <div className="rounded-lg border border-border bg-bg px-3 py-4 text-center">
                  <p className="text-sm text-text">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => void loadInitial()}
                    className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Tentar de novo
                  </button>
                </div>
              ) : events.length === 0 && isLoadingEvents ? (
                <p className="text-sm text-muted">Carregando eventos…</p>
              ) : (
                <>
                  {events.length > 0 && visibleEvents.length === 0 ? (
                    <div className="rounded-lg border border-border bg-bg px-3 py-4 text-center">
                      <p className="text-sm text-muted">Nenhum evento desses tipos no período.</p>
                      <button
                        type="button"
                        onClick={() => setTypeIds([])}
                        className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
                      >
                        Mostrar todos os tipos
                      </button>
                    </div>
                  ) : events.length === 0 ? (
                    <p className="rounded-lg border border-border bg-bg px-3 py-4 text-center text-sm text-muted">
                      Nenhum evento futuro em que você possa editar a programação até{' '}
                      {rangeEnd?.toLocaleDateString('pt-BR')}.
                    </p>
                  ) : (
                    <ul className="max-h-[40vh] space-y-1 overflow-y-auto">
                      {visibleEvents.map((event) => {
                        const checked = selectedIds.has(event.id);
                        const isDuplicate = duplicateEventIds.has(event.id);
                        return (
                          <li key={event.id}>
                            <label
                              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                                checked ? 'border-primary bg-primary/5' : 'border-border bg-bg'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEvent(event.id)}
                                className="mt-1"
                              />
                              {renderEventLabel(
                                event,
                                isDuplicate ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                    <IconAlertTriangle className="h-3 w-3" />
                                    {isWholePiece ? 'Já tem a obra' : 'Já tem este trecho'}
                                  </span>
                                ) : null,
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleLoadMore()}
                    disabled={isLoadingEvents || !rangeEnd}
                    className="self-center rounded-lg bg-bg px-3 py-1.5 text-sm font-medium text-primary hover:bg-border/40 disabled:opacity-60"
                  >
                    {isLoadingEvents ? 'Carregando…' : `Ver mais ${RANGE_DAYS} dias`}
                  </button>
                </>
              )}
            </section>

            {selectedDuplicates > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {selectedDuplicates === 1
                    ? '1 evento selecionado já tem '
                    : `${selectedDuplicates} eventos selecionados já têm `}
                  {isWholePiece ? 'esta obra' : 'este trecho'} na programação. Uma nova linha será
                  adicionada mesmo assim.
                </span>
              </p>
            )}

            {selectedIds.size > MAX_EVENTS_PER_SUBMIT && (
              <p className="text-sm text-red-600">
                Selecione no máximo {MAX_EVENTS_PER_SUBMIT} eventos por vez.
              </p>
            )}
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg bg-bg px-4 py-2 text-sm font-medium text-text hover:bg-border/40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={
                  isSubmitting ||
                  selectedIds.size === 0 ||
                  selectedIds.size > MAX_EVENTS_PER_SUBMIT
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isSubmitting
                  ? 'Adicionando…'
                  : selectedDuplicates > 0
                    ? 'Adicionar mesmo assim'
                    : selectedIds.size > 1
                      ? `Adicionar a ${selectedIds.size} eventos`
                      : 'Adicionar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <EventProgramUnitsEditor
        open={open && unitsEditorOpen}
        onClose={() => setUnitsEditorOpen(false)}
        pieceTitle={piece.title}
        fileOrganization={piece.fileOrganization}
        scoreFiles={scoreFiles}
        shortcutsByFileId={shortcutsByFileId}
        tocEntriesByFileId={tocEntriesByFileId}
        initialUnits={units}
        onConfirm={setUnits}
      />
    </>
  );
}
