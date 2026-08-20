import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { EventKind, EventListItem, EventType } from '@/domain/agenda';
import { eventHasNoAudience, extraAudienceMusicianIds } from '@/domain/agenda';
import type { AssociableAudience } from '@/application/agenda';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import { useAgenda, useOffline } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { CategoryHuePicker } from '@/ui/components/CategoryHuePicker';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { Modal } from '@/ui/components/Modal';
import { IconChevronLeft, IconPlus, IconSettings } from '@/ui/components/icons';
import { AgendaEventTypesSection } from '@/ui/features/agenda/AgendaEventTypesSection';
import { AgendaEventsSection } from '@/ui/features/agenda/AgendaEventsSection';
import { AgendaFiltersBar, type AgendaFilterScope } from '@/ui/features/agenda/AgendaFiltersBar';
import { AgendaRangeControls } from '@/ui/features/agenda/AgendaRangeControls';
import {
  fromDatetimeLocalValue,
  getWeekRange,
  shiftAnchor,
  toDatetimeLocalValue,
  toIsoRange,
} from '@/ui/features/agenda/agenda-date';
import { loadAgendaFilters, saveAgendaFilters } from '@/ui/features/agenda/agenda-filters-storage';
import { loadAgendaRange, saveAgendaRange } from '@/ui/features/agenda/agenda-range-storage';
import { agendaErrorMessage, eventKindLabel } from '@/ui/features/agenda/agenda-labels';
import {
  agendaSectionQueryValue,
  eventPath,
  parseAgendaSection,
} from '@/ui/features/agenda/agenda-routes';
import { EventAudienceFields } from '@/ui/features/agenda/EventAudienceFields';
import { EventFormFields } from '@/ui/features/agenda/EventFormFields';
import {
  DEFAULT_CATEGORY_HUE,
  formatCategoryHue,
  parseCategoryHue,
} from '@/ui/features/repertoire/category-color';
import {
  orgListPageHeightClass,
  orgPageContentClass,
} from '@/ui/layouts/OrgListPageLayout';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

const EVENT_KIND_OPTIONS: EventKind[] = ['rehearsal', 'service', 'class', 'special'];

type EventTypeModalState = {
  id: string | null;
  name: string;
  kind: EventKind;
  hue: number;
};

function defaultStartsAtLocal(): string {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  return toDatetimeLocalValue(now.toISOString());
}

export function AgendaPage() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const agenda = useAgenda();
  const offline = useOffline();
  const online = useOnlineStatus();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((item) => item.slug === orgSlug);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';
  const adminSection = isAdmin ? parseAgendaSection(searchParams.get('secao')) : null;
  const showEventTypesView = adminSection === 'event-types';
  const pageTitle = showEventTypesView ? 'Tipos de evento' : 'Agenda';

  const [anchor, setAnchor] = useState(() => new Date());
  const [rangeReady, setRangeReady] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const [scope, setScope] = useState<AgendaFilterScope>('mine');
  const [filterKind, setFilterKind] = useState<EventKind | ''>('');
  const [filterTypeId, setFilterTypeId] = useState('');
  const [filterGroupId, setFilterGroupId] = useState('');

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [audience, setAudience] = useState<AssociableAudience | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [offlineCachedAt, setOfflineCachedAt] = useState<string | null>(null);
  const [offlineRangeError, setOfflineRangeError] = useState(false);
  useLoadingBar('agenda', isLoading);

  const isOfflineReadOnly = !online;
  const canCreateEvents = !isOfflineReadOnly && (isAdmin || Boolean(audience?.canCreateEvents));

  const [createOpen, setCreateOpen] = useState(false);
  const [confirmEmptyAudience, setConfirmEmptyAudience] = useState(false);
  const [typeId, setTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStartsAtLocal);
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [musicianIds, setMusicianIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [typeModal, setTypeModal] = useState<EventTypeModalState | null>(null);
  const [typeModalError, setTypeModalError] = useState<string | null>(null);
  const [isSavingType, setIsSavingType] = useState(false);

  function openEventTypesSection() {
    setSearchParams({ secao: agendaSectionQueryValue('event-types') });
  }

  function closeEventTypesSection() {
    setSearchParams({});
  }

  const loadEventTypes = useCallback(async () => {
    if (!org) {
      return;
    }
    const typesResult = await agenda.listEventTypes(org.id);
    if (typesResult.ok) {
      setEventTypes(typesResult.value);
    }
  }, [agenda, org]);

  useEffect(() => {
    if (!userId) {
      setRangeReady(true);
      setFiltersReady(true);
      return;
    }
    const storedRange = loadAgendaRange(userId);
    if (storedRange) {
      setAnchor(new Date(storedRange.anchorIso));
    }
    const storedFilters = loadAgendaFilters(userId);
    if (storedFilters) {
      setScope(storedFilters.scope);
      setFilterKind(storedFilters.kind);
      setFilterTypeId(storedFilters.typeId);
      setFilterGroupId(storedFilters.groupId);
    }
    setRangeReady(true);
    setFiltersReady(true);
  }, [userId]);

  useEffect(() => {
    if (!userId || !rangeReady) {
      return;
    }
    saveAgendaRange(userId, 'week', anchor);
  }, [userId, anchor, rangeReady]);

  useEffect(() => {
    if (!userId || !filtersReady) {
      return;
    }
    saveAgendaFilters(userId, {
      scope,
      kind: filterKind,
      typeId: filterTypeId,
      groupId: filterGroupId,
    });
  }, [userId, filtersReady, scope, filterKind, filterTypeId, filterGroupId]);

  const loadData = useCallback(async () => {
    if (!org || !userId) {
      return;
    }

    if (showEventTypesView) {
      if (!isBrowserOnline()) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      await loadEventTypes();
      setIsLoading(false);
      return;
    }

    if (!isBrowserOnline()) {
      setIsLoading(true);
      setOfflineRangeError(false);
      const { from, to } = getWeekRange(anchor);
      const range = toIsoRange(from, to);
      const cached = await offline.listCachedEventsInRange(org.id, userId, {
        ...range,
        mineOnly: isAdmin && scope === 'mine',
        typeId: filterTypeId || null,
        kind: filterKind || null,
        groupId: filterGroupId || null,
      });

      if (!cached.withinCachedRange) {
        setOfflineRangeError(true);
        setEvents([]);
      } else {
        setOfflineRangeError(false);
        setEvents(cached.events);
      }

      setOfflineCachedAt(cached.cachedAt);
      setEventTypes(await offline.getCachedEventTypes(org.id, userId));
      const cachedAudience = await offline.getCachedAssociableAudience(org.id, userId);
      if (cachedAudience) {
        setAudience(cachedAudience);
      }
      setIsLoading(false);
      return;
    }

    setOfflineCachedAt(null);
    setOfflineRangeError(false);

    setIsLoading(true);
    const { from, to } = getWeekRange(anchor);
    const range = toIsoRange(from, to);

    const [typesResult, eventsResult, audienceResult] = await Promise.all([
      agenda.listEventTypes(org.id),
      agenda.listEventsInRange(org.id, userId, {
        ...range,
        mineOnly: isAdmin && scope === 'mine',
        typeId: filterTypeId || null,
        kind: filterKind || null,
        groupId: filterGroupId || null,
      }),
      agenda.listAssociableAudience(org.id, userId),
    ]);

    if (typesResult.ok) {
      setEventTypes(typesResult.value);
    }

    if (eventsResult.ok) {
      setEvents(eventsResult.value);
    } else {
      setEvents([]);
    }

    if (audienceResult.ok) {
      setAudience(audienceResult.value);
    }

    setIsLoading(false);
  }, [
    agenda,
    offline,
    org,
    userId,
    anchor,
    showEventTypesView,
    loadEventTypes,
    isAdmin,
    scope,
    filterTypeId,
    filterKind,
    filterGroupId,
  ]);

  useEffect(() => {
    if (eventTypes.length > 0 && !typeId) {
      const sundayType = eventTypes.find((type) =>
        type.name.toLowerCase().includes('domingo'),
      );
      setTypeId(sundayType?.id ?? eventTypes[0].id);
    }
  }, [eventTypes, typeId]);

  useEffect(() => {
    if (!org || !rangeReady || !filtersReady) {
      return;
    }
    void loadData();
  }, [org, rangeReady, filtersReady, loadData]);

  function openCreateTypeModal() {
    setTypeModal({
      id: null,
      name: '',
      kind: 'service',
      hue: DEFAULT_CATEGORY_HUE,
    });
    setTypeModalError(null);
  }

  function openEditTypeModal(eventType: EventType) {
    setTypeModal({
      id: eventType.id,
      name: eventType.name,
      kind: eventType.kind,
      hue: parseCategoryHue(eventType.color, eventType.kind),
    });
    setTypeModalError(null);
  }

  async function handleSaveEventType(event: React.FormEvent) {
    event.preventDefault();
    if (!org || !typeModal) {
      return;
    }

    setTypeModalError(null);
    setIsSavingType(true);

    const input = {
      name: typeModal.name,
      kind: typeModal.kind,
      color: formatCategoryHue(typeModal.hue),
      sortOrder: typeModal.id
        ? eventTypes.find((item) => item.id === typeModal.id)?.sortOrder
        : (eventTypes[eventTypes.length - 1]?.sortOrder ?? 0) + 1,
    };

    const result = typeModal.id
      ? await agenda.updateEventType(org.id, typeModal.id, input)
      : await agenda.createEventType(org.id, input);

    setIsSavingType(false);

    if (!result.ok) {
      setTypeModalError(agendaErrorMessage(result.error));
      return;
    }

    setTypeModal(null);
    await loadEventTypes();
    if (!showEventTypesView) {
      void loadData();
    }
  }

  async function handleDeleteEventType() {
    if (!org || !typeModal?.id) {
      return;
    }

    setTypeModalError(null);
    setIsSavingType(true);

    const result = await agenda.deleteEventType(org.id, typeModal.id);

    setIsSavingType(false);

    if (!result.ok) {
      setTypeModalError(agendaErrorMessage(result.error));
      return;
    }

    setTypeModal(null);
    await loadEventTypes();
    if (!showEventTypesView) {
      void loadData();
    }
  }

  function resetCreateForm() {
    setTitle('');
    setStartsAt(defaultStartsAtLocal());
    setEndsAt('');
    setNotes('');
    setGroupIds([]);
    setMusicianIds(audience?.myMusicianId ? [audience.myMusicianId] : []);
    setFormError(null);
  }

  function hasEmptyAudience() {
    return eventHasNoAudience(
      groupIds,
      extraAudienceMusicianIds(musicianIds, audience?.myMusicianId ?? null),
    );
  }

  async function handleCreateEvent() {
    if (!org || !userId) {
      return;
    }
    setConfirmEmptyAudience(false);
    setFormError(null);
    setIsSubmitting(true);

    const result = await agenda.scheduleEvent(org.id, userId, {
      typeId,
      title: title.trim() || null,
      startsAt: fromDatetimeLocalValue(startsAt),
      endsAt: endsAt ? fromDatetimeLocalValue(endsAt) : null,
      notes: notes.trim() || null,
      groupIds,
      musicianIds,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setFormError(agendaErrorMessage(result.error));
      return;
    }

    setCreateOpen(false);
    navigate(eventPath(org.slug, result.value.id));
  }

  function requestCreateEvent() {
    if (hasEmptyAudience()) {
      setConfirmEmptyAudience(true);
      return;
    }
    void handleCreateEvent();
  }

  return (
    <>
      <div className={`flex min-w-0 flex-col overflow-hidden ${orgPageContentClass} ${orgListPageHeightClass}`}>
        <div className="shrink-0 space-y-4 pb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {showEventTypesView && (
                <button
                  type="button"
                  onClick={closeEventTypesSection}
                  className="flex shrink-0 items-center justify-center rounded-lg border border-border p-1 text-muted transition-colors hover:bg-surface hover:text-text"
                  aria-label="Voltar à agenda"
                >
                  <IconChevronLeft className="h-6 w-6" />
                </button>
              )}
              <h1 className="text-2xl font-semibold text-text">{pageTitle}</h1>
            </div>
            {(isAdmin || canCreateEvents) && !showEventTypesView && !isOfflineReadOnly && (
              <div className="flex shrink-0 items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={openEventTypesSection}
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-surface p-2 text-muted transition-colors hover:bg-bg hover:text-text"
                    aria-label="Configurar tipos de evento"
                  >
                    <IconSettings className="h-4 w-4" />
                  </button>
                )}
                {canCreateEvents && (
                  <button
                    type="button"
                    onClick={() => {
                      resetCreateForm();
                      setCreateOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
                  >
                    <IconPlus className="h-4 w-4" />
                    Evento
                  </button>
                )}
              </div>
            )}
            {isAdmin && showEventTypesView && !isOfflineReadOnly && (
              <button
                type="button"
                onClick={openCreateTypeModal}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
              >
                <IconPlus className="h-4 w-4" />
                Tipo
              </button>
            )}
          </div>

          {!showEventTypesView && isOfflineReadOnly && (
            <p className="text-sm text-muted">
              Modo offline — somente leitura
              {offlineCachedAt
                ? ` · dados de ${new Intl.DateTimeFormat('pt-BR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(offlineCachedAt))}`
                : ''}
            </p>
          )}

          {!showEventTypesView && (
            <>
              <AgendaFiltersBar
                showScopeToggle={isAdmin}
                scope={scope}
                onScopeChange={setScope}
                kind={filterKind}
                onKindChange={setFilterKind}
                typeId={filterTypeId}
                onTypeIdChange={setFilterTypeId}
                groupId={filterGroupId}
                onGroupIdChange={setFilterGroupId}
                types={eventTypes}
                groups={audience?.filterGroups ?? []}
                rangeControls={
                  <AgendaRangeControls
                    anchor={anchor}
                    onPrevious={() => setAnchor((current) => shiftAnchor('week', current, -1))}
                    onNext={() => setAnchor((current) => shiftAnchor('week', current, 1))}
                  />
                }
              />
            </>
          )}
          <hr className="border-border" />
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          {showEventTypesView && isOfflineReadOnly ? (
            <p className="text-sm text-muted">
              Gerir tipos de evento exige conexão com a internet.
            </p>
          ) : showEventTypesView ? (
            isLoading ? (
              <p className="text-sm text-muted">Carregando…</p>
            ) : (
              <AgendaEventTypesSection
                types={eventTypes}
                onCreate={openCreateTypeModal}
                onEdit={openEditTypeModal}
              />
            )
          ) : offlineRangeError ? (
            <p className="text-sm text-muted">
              Esta semana está fora do intervalo disponível offline (semana atual até 90 dias à
              frente).
            </p>
          ) : (
            <AgendaEventsSection orgSlug={orgSlug ?? ''} events={events} isLoading={isLoading} />
          )}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo evento" size="lg">
        <div className="max-h-[min(80vh,40rem)] space-y-4 overflow-y-auto pr-1">
          <EventFormFields
            types={eventTypes}
            typeId={typeId}
            onTypeIdChange={setTypeId}
            title={title}
            onTitleChange={setTitle}
            startsAt={startsAt}
            onStartsAtChange={setStartsAt}
            endsAt={endsAt}
            onEndsAtChange={setEndsAt}
            notes={notes}
            onNotesChange={setNotes}
          />
          <EventAudienceFields
            groups={audience?.groups ?? []}
            musicians={audience?.musicians ?? []}
            selectedGroupIds={groupIds}
            selectedMusicianIds={musicianIds}
            onGroupIdsChange={setGroupIds}
            onMusicianIdsChange={setMusicianIds}
            lockedMusicianIds={audience?.myMusicianId ? [audience.myMusicianId] : []}
          />
          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={requestCreateEvent}
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isSubmitting ? 'Criando…' : 'Criar e editar'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmEmptyAudience}
        title="Evento sem associação"
        message="Nenhum grupo ou músico associado. Só owners e admins poderão ver este evento. Continuar?"
        confirmLabel="Criar mesmo assim"
        onConfirm={() => void handleCreateEvent()}
        onClose={() => setConfirmEmptyAudience(false)}
        isConfirming={isSubmitting}
      />

      <Modal
        open={typeModal !== null}
        onClose={() => setTypeModal(null)}
        title={typeModal?.id ? 'Editar tipo' : 'Novo tipo de evento'}
      >
        {typeModal && (
          <form onSubmit={(event) => void handleSaveEventType(event)} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Nome</span>
              <input
                type="text"
                value={typeModal.name}
                onChange={(event) =>
                  setTypeModal((current) =>
                    current ? { ...current, name: event.target.value } : current,
                  )
                }
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-muted">Categoria</span>
              <select
                value={typeModal.kind}
                onChange={(event) =>
                  setTypeModal((current) =>
                    current ? { ...current, kind: event.target.value as EventKind } : current,
                  )
                }
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
              >
                {EVENT_KIND_OPTIONS.map((kind) => (
                  <option key={kind} value={kind}>
                    {eventKindLabel(kind)}
                  </option>
                ))}
              </select>
            </label>

            <CategoryHuePicker
              hue={typeModal.hue}
              onChange={(hue) =>
                setTypeModal((current) => (current ? { ...current, hue } : current))
              }
            />

            {typeModalError && (
              <p className="text-sm text-red-600 dark:text-red-400">{typeModalError}</p>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              {typeModal.id ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteEventType()}
                  disabled={isSavingType}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                >
                  Excluir
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTypeModal(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-text"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingType}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {isSavingType ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
