import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AssociableAudience } from '@/application/agenda';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import type { EventDetail, EventType } from '@/domain/agenda';
import {
  canWriteEvent,
  eventDisplayTitle,
  eventHasNoAudience,
  extraAudienceMusicianIds,
} from '@/domain/agenda';
import { useAgenda, useOffline } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { BackButton } from '@/ui/components/BackButton';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { Tabs } from '@/ui/components/Tabs';
import {
  fromDatetimeLocalValue,
  formatEventTime,
  toDatetimeLocalValue,
} from '@/ui/features/agenda/agenda-date';
import { agendaErrorMessage } from '@/ui/features/agenda/agenda-labels';
import { agendaPath } from '@/ui/features/agenda/agenda-routes';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';
import { EventAudienceChips } from '@/ui/features/agenda/EventAudienceChips';
import { EventAudienceFields } from '@/ui/features/agenda/EventAudienceFields';
import type { RecurrenceEditScope } from '@/domain/agenda';
import { EventFormFields } from '@/ui/features/agenda/EventFormFields';
import {
  CancelRecurrenceConfirmModal,
  RecurrenceScopeModal,
} from '@/ui/features/agenda/RecurrenceScopeModal';
import { EventProgramSection } from '@/ui/features/agenda/EventProgramSection';
import { EventAbsencesSection } from '@/ui/features/agenda/EventAbsencesSection';
import {
  orgListPageHeightClass,
  orgPageContentClass,
} from '@/ui/layouts/OrgListPageLayout';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

function mergeOptions<T extends { id: string }>(primary: T[], extra: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of extra) {
    byId.set(item.id, item);
  }
  for (const item of primary) {
    const current = byId.get(item.id);
    byId.set(item.id, current ? { ...current, ...item } : item);
  }
  return [...byId.values()];
}

export function EventDetailPage() {
  const { orgSlug, eventId } = useParams();
  const navigate = useNavigate();
  const agenda = useAgenda();
  const offline = useOffline();
  const online = useOnlineStatus();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((item) => item.slug === orgSlug);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [audience, setAudience] = useState<AssociableAudience | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('event-detail', isLoading);
  const [error, setError] = useState<string | null>(null);

  const [typeId, setTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [musicianIds, setMusicianIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmEmptyAudience, setConfirmEmptyAudience] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [recurrenceScopeMode, setRecurrenceScopeMode] = useState<'save' | 'delete' | null>(null);
  const [confirmCancelRecurrence, setConfirmCancelRecurrence] = useState(false);
  const [isCancellingRecurrence, setIsCancellingRecurrence] = useState(false);
  const [cancelRecurrenceError, setCancelRecurrenceError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!org || !eventId) {
      return;
    }
    setIsLoading(true);
    setError(null);

    if (!isBrowserOnline()) {
      if (!userId) {
        setEvent(null);
        setError('Evento não disponível offline.');
        setIsLoading(false);
        return;
      }

      const detail = await offline.getCachedEventDetail(org.id, userId, eventId);
      const types = await offline.getCachedEventTypes(org.id, userId);
      const cachedAudience = await offline.getCachedAssociableAudience(org.id, userId);

      setEventTypes(types);
      if (cachedAudience) {
        setAudience(cachedAudience);
      }

      if (!detail) {
        setEvent(null);
        setError('Evento não disponível offline.');
        setIsLoading(false);
        return;
      }

      setEvent(detail);
      setTypeId(detail.typeId);
      setTitle(detail.title ?? '');
      setStartsAt(toDatetimeLocalValue(detail.startsAt));
      setEndsAt(detail.endsAt ? toDatetimeLocalValue(detail.endsAt) : '');
      setNotes(detail.notes ?? '');
      setGroupIds(detail.groups.map((group) => group.id));
      setMusicianIds(detail.musicians.map((musician) => musician.id));
      setIsLoading(false);
      return;
    }

    const [eventResult, typesResult, audienceResult] = await Promise.all([
      agenda.getEvent(org.id, eventId),
      agenda.listEventTypes(org.id),
      userId ? agenda.listAssociableAudience(org.id, userId) : Promise.resolve(null),
    ]);

    if (typesResult.ok) {
      setEventTypes(typesResult.value);
    }

    if (audienceResult && audienceResult.ok) {
      setAudience(audienceResult.value);
    }

    if (!eventResult.ok) {
      setEvent(null);
      setError(agendaErrorMessage(eventResult.error));
      setIsLoading(false);
      return;
    }

    const detail = eventResult.value;
    setEvent(detail);
    setTypeId(detail.typeId);
    setTitle(detail.title ?? '');
    setStartsAt(toDatetimeLocalValue(detail.startsAt));
    setEndsAt(detail.endsAt ? toDatetimeLocalValue(detail.endsAt) : '');
    setNotes(detail.notes ?? '');
    setGroupIds(detail.groups.map((group) => group.id));
    setMusicianIds(detail.musicians.map((musician) => musician.id));
    setIsLoading(false);
  }, [agenda, offline, org, eventId, userId]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const isOfflineReadOnly = !online;

  const canWrite = Boolean(
    !isOfflineReadOnly &&
      event &&
      userId &&
      canWriteEvent({
        isPrivileged: isAdmin,
        isGroupWriter: Boolean(audience?.isGroupWriter),
        userId,
        createdBy: event.createdBy,
        eventGroupIds: event.groups.map((group) => group.id),
        writableGroupIds: audience?.writableGroupIds ?? [],
      }),
  );

  function hasEmptyAudience() {
    return eventHasNoAudience(
      groupIds,
      extraAudienceMusicianIds(musicianIds, audience?.myMusicianId ?? null),
    );
  }

  async function handleSave(scope?: RecurrenceEditScope) {
    if (!org || !eventId || !userId) {
      return;
    }
    setConfirmEmptyAudience(false);
    setSaveError(null);
    setIsSaving(true);

    const input = {
      typeId,
      title: title.trim() || null,
      startsAt: fromDatetimeLocalValue(startsAt),
      endsAt: endsAt ? fromDatetimeLocalValue(endsAt) : null,
      location: event?.location ?? null,
      notes: notes.trim() || null,
      groupIds,
      musicianIds,
    };

    const result =
      event?.recurrenceId && scope
        ? await agenda.updateRecurrenceOccurrence(org.id, userId, eventId, scope, input)
        : await agenda.updateEvent(org.id, userId, eventId, input);

    setIsSaving(false);
    setRecurrenceScopeMode(null);

    if (!result.ok) {
      setSaveError(agendaErrorMessage(result.error));
      return;
    }

    const saved: EventDetail = result.value;
    setEvent(saved);
    setGroupIds(saved.groups.map((group) => group.id));
    setMusicianIds(saved.musicians.map((musician) => musician.id));

    if (saved.id !== eventId) {
      navigate(`/${orgSlug}/agenda/eventos/${saved.id}`, { replace: true });
    }
  }

  function requestSave() {
    if (hasEmptyAudience()) {
      setConfirmEmptyAudience(true);
      return;
    }
    if (event?.recurrenceId) {
      setRecurrenceScopeMode('save');
      return;
    }
    void handleSave();
  }

  async function handleDelete(scope?: RecurrenceEditScope) {
    if (!org || !eventId || !userId) {
      return;
    }

    setDeleteError(null);
    setIsDeleting(true);

    const result =
      event?.recurrenceId && scope
        ? await agenda.deleteRecurrenceOccurrence(org.id, userId, eventId, scope)
        : await agenda.deleteEvent(org.id, userId, eventId);

    setIsDeleting(false);
    setRecurrenceScopeMode(null);
    setConfirmDelete(false);

    if (!result.ok) {
      setDeleteError(agendaErrorMessage(result.error));
      return;
    }

    navigate(agendaPath(orgSlug ?? ''));
  }

  function requestDelete() {
    if (event?.recurrenceId) {
      setRecurrenceScopeMode('delete');
      return;
    }
    setConfirmDelete(true);
  }

  async function handleCancelRecurrence() {
    if (!org || !userId || !event?.recurrenceId) {
      return;
    }

    setCancelRecurrenceError(null);
    setIsCancellingRecurrence(true);

    const result = await agenda.cancelRecurrence(org.id, userId, event.recurrenceId);

    setIsCancellingRecurrence(false);
    setConfirmCancelRecurrence(false);

    if (!result.ok) {
      setCancelRecurrenceError(agendaErrorMessage(result.error));
      return;
    }

    navigate(agendaPath(orgSlug ?? ''));
  }

  if (isLoading) {
    return (
      <div className={`${orgPageContentClass} px-4 py-6 ${orgListPageHeightClass}`}>
        <p className="text-sm text-muted">Carregando…</p>
      </div>
    );
  }

  if (!event || error) {
    return (
      <div className={`${orgPageContentClass} px-4 py-6 ${orgListPageHeightClass}`}>
        <div className="space-y-4">
          <BackButton fallbackTo={agendaPath(orgSlug ?? '')} />
          <p className="text-sm text-muted">{error ?? 'Evento não encontrado.'}</p>
        </div>
      </div>
    );
  }

  const displayTitle = eventDisplayTitle(event, event.type);
  const badgeStyle = eventTypeBadgeStyle(event.type);

  const detailsForm = (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
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
        groups={mergeOptions(
          audience?.groups ?? [],
          event.groups.map((group) => ({
            id: group.id,
            name: group.name,
            kind: group.kind,
          })),
        )}
        musicians={mergeOptions(
          audience?.musicians ?? [],
          event.musicians.map((musician) => ({
            id: musician.id,
            name: musician.fullName,
            partNames: [],
          })),
        )}
        selectedGroupIds={groupIds}
        selectedMusicianIds={musicianIds}
        onGroupIdsChange={setGroupIds}
        onMusicianIdsChange={setMusicianIds}
        lockedGroupIds={
          audience && !audience.isPrivileged
            ? event.groups
                .filter((group) => !audience.writableGroupIds.includes(group.id))
                .map((group) => group.id)
            : []
        }
        lockedMusicianIds={[
          ...(audience?.myMusicianId ? [audience.myMusicianId] : []),
          ...(audience && !audience.isPrivileged
            ? event.musicians
                .filter((musician) => {
                  if (musician.id === audience.myMusicianId) {
                    return false;
                  }
                  return !audience.musicians.some((item) => item.id === musician.id);
                })
                .map((musician) => musician.id)
            : []),
        ]}
      />
      {saveError && (
        <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={requestSave}
          disabled={isSaving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSaving ? 'Salvando…' : 'Salvar detalhes'}
        </button>
      </div>
    </section>
  );

  return (
    <div className={`${orgPageContentClass}  ${orgListPageHeightClass} overflow-y-auto`}>
      <section className="mb-6 space-y-2">
        <div className="flex items-start gap-2">
          <BackButton fallbackTo={agendaPath(orgSlug ?? '')} />
          <div className="min-w-0 flex-1 ml-1">
            <div className="flex items-center justify-between gap-3">
              <h1 className="min-w-0 truncate text-xl font-semibold text-text sm:text-2xl">
                {displayTitle}
              </h1>
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={badgeStyle}
              >
                {event.type.name}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatEventTime(event.startsAt, event.endsAt)}
            </p>
            {isOfflineReadOnly && (
              <p className="mt-1 text-sm text-muted">Modo offline — somente leitura</p>
            )}
            {event.recurrenceId && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-medium text-muted">
                  Série recorrente
                  {event.isException ? ' · exceção' : ''}
                </span>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setConfirmCancelRecurrence(true)}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Cancelar série (futuros)
                  </button>
                )}
              </div>
            )}
            {cancelRecurrenceError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{cancelRecurrenceError}</p>
            )}
            <EventAudienceChips
              groups={event.groups}
              musicians={event.musicians}
              className="mt-1 text-sm"
            />
          </div>
        </div>
      </section>

      {canWrite ? (
        <Tabs
          tabs={[
            {
              id: 'detalhes',
              label: 'Detalhes',
              content: detailsForm,
            },
            {
              id: 'programacao',
              label: 'Programação',
              content:
                org && eventId ? (
                  <EventProgramSection
                    orgSlug={orgSlug ?? ''}
                    organizationId={org.id}
                    eventId={eventId}
                    program={event.program}
                    isAdmin
                    hideHeading
                    onProgramSaved={(program) =>
                      setEvent((current) => (current ? { ...current, program } : current))
                    }
                    setEventProgram={agenda.setEventProgram}
                  />
                ) : null,
            },
            {
              id: 'ausencias',
              label: 'Ausências',
              content:
                org && eventId ? (
                  <EventAbsencesSection
                    organizationId={org.id}
                    eventId={eventId}
                    groups={event.groups}
                    musicians={event.musicians}
                    disabled={isOfflineReadOnly}
                  />
                ) : null,
            },
          ]}
        />
      ) : (
        <div className="space-y-6">
          {event.notes && (
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-base font-semibold text-text">Observações</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{event.notes}</p>
            </section>
          )}
          {event.program.length > 0 && org && eventId && (
            <EventProgramSection
              orgSlug={orgSlug ?? ''}
              organizationId={org.id}
              eventId={eventId}
              program={event.program}
              isAdmin={false}
              onProgramSaved={(program) =>
                setEvent((current) => (current ? { ...current, program } : current))
              }
              setEventProgram={agenda.setEventProgram}
            />
          )}
        </div>
      )}

      {canWrite && (
        <section className="mt-8 border-t border-border pt-6">
          {deleteError && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
          )}
          <button
            type="button"
            onClick={requestDelete}
            disabled={isDeleting || isSaving}
            className="rounded-lg border border-red-600/40 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-600/10 disabled:opacity-50 dark:text-red-400 w-full md:w-auto"
          >
            Excluir evento
          </button>
        </section>
      )}

      <ConfirmModal
        open={confirmEmptyAudience}
        title="Evento sem associação"
        message="Nenhum grupo ou músico associado. Só owners e admins poderão ver este evento. Continuar?"
        confirmLabel="Salvar mesmo assim"
        onConfirm={() => {
          if (event?.recurrenceId) {
            setConfirmEmptyAudience(false);
            setRecurrenceScopeMode('save');
            return;
          }
          void handleSave();
        }}
        onClose={() => setConfirmEmptyAudience(false)}
        isConfirming={isSaving}
      />

      <RecurrenceScopeModal
        open={recurrenceScopeMode === 'save'}
        mode="save"
        onClose={() => setRecurrenceScopeMode(null)}
        onConfirm={(scope) => void handleSave(scope)}
        isConfirming={isSaving}
      />

      <RecurrenceScopeModal
        open={recurrenceScopeMode === 'delete'}
        mode="delete"
        onClose={() => setRecurrenceScopeMode(null)}
        onConfirm={(scope) => void handleDelete(scope)}
        isConfirming={isDeleting}
      />

      <CancelRecurrenceConfirmModal
        open={confirmCancelRecurrence}
        onClose={() => setConfirmCancelRecurrence(false)}
        onConfirm={() => void handleCancelRecurrence()}
        isConfirming={isCancellingRecurrence}
      />

      <ConfirmModal
        open={confirmDelete}
        title="Excluir evento?"
        message={
          <>
            O evento <strong className="text-text">{displayTitle}</strong> será removido
            permanentemente, incluindo a programação associada.
          </>
        }
        confirmLabel="Excluir evento"
        onConfirm={() => void handleDelete()}
        onClose={() => {
          setConfirmDelete(false);
          setDeleteError(null);
        }}
        isConfirming={isDeleting}
      />
    </div>
  );
}
