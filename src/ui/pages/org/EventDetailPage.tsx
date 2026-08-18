import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { EventDetail, EventType } from '@/domain/agenda';
import { eventDisplayTitle } from '@/domain/agenda';
import { useAgenda } from '@/ui/app/AppServicesContext';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { BackButton } from '@/ui/components/BackButton';
import { Tabs } from '@/ui/components/Tabs';
import {
  fromDatetimeLocalValue,
  formatEventTime,
  toDatetimeLocalValue,
} from '@/ui/features/agenda/agenda-date';
import { agendaErrorMessage } from '@/ui/features/agenda/agenda-labels';
import { agendaPath } from '@/ui/features/agenda/agenda-routes';
import { eventTypeBadgeStyle } from '@/ui/features/agenda/event-type-color';
import { EventFormFields } from '@/ui/features/agenda/EventFormFields';
import { EventProgramSection } from '@/ui/features/agenda/EventProgramSection';
import {
  orgListPageHeightClass,
  orgPageContentClass,
} from '@/ui/layouts/OrgListPageLayout';

export function EventDetailPage() {
  const { orgSlug, eventId } = useParams();
  const agenda = useAgenda();
  const { organizations } = useOrg();
  const org = organizations.find((item) => item.slug === orgSlug);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('event-detail', isLoading);
  const [error, setError] = useState<string | null>(null);

  const [typeId, setTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!org || !eventId) {
      return;
    }
    setIsLoading(true);
    setError(null);

    const [eventResult, typesResult] = await Promise.all([
      agenda.getEvent(org.id, eventId),
      agenda.listEventTypes(org.id),
    ]);

    if (typesResult.ok) {
      setEventTypes(typesResult.value);
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
    setIsLoading(false);
  }, [agenda, org, eventId]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  async function handleSave() {
    if (!org || !eventId) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);

    const result = await agenda.updateEvent(org.id, eventId, {
      typeId,
      title: title.trim() || null,
      startsAt: fromDatetimeLocalValue(startsAt),
      endsAt: endsAt ? fromDatetimeLocalValue(endsAt) : null,
      location: event?.location ?? null,
      notes: notes.trim() || null,
    });

    setIsSaving(false);

    if (!result.ok) {
      setSaveError(agendaErrorMessage(result.error));
      return;
    }

    setEvent(result.value);
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

  return (
    <div className={`${orgPageContentClass}  ${orgListPageHeightClass} overflow-y-auto`}>
      <section className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <BackButton fallbackTo={agendaPath(orgSlug ?? '')} />
          <div className="min-w-0 flex-1 ml-1">
            <h1 className="text-xl font-semibold text-text sm:text-2xl">{displayTitle}</h1>
            <p className="mt-1 text-sm text-muted">
              {formatEventTime(event.startsAt, event.endsAt)}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={badgeStyle}
          >
            {event.type.name}
          </span>
        </div>
      </section>

      {isAdmin ? (
        <Tabs
          tabs={[
            {
              id: 'detalhes',
              label: 'Detalhes',
              content: (
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
                  {saveError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={isSaving}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {isSaving ? 'Salvando…' : 'Salvar detalhes'}
                    </button>
                  </div>
                </section>
              ),
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
    </div>
  );
}
