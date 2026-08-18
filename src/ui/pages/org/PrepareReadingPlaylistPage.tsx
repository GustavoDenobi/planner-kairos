import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import type { EventDetail } from '@/domain/agenda';
import { eventDisplayTitle } from '@/domain/agenda';
import type { PieceFileWithLinks } from '@/domain/repertoire';
import {
  filterScoreCandidatesForUser,
  resolveDefaultScoreFile,
} from '@/domain/repertoire';
import { useAgenda, useEnsemble, useRepertoire } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { BackButton } from '@/ui/components/BackButton';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { IconPlus, IconTrash } from '@/ui/components/icons';
import { formatEventTime } from '@/ui/features/agenda/agenda-date';
import { agendaErrorMessage } from '@/ui/features/agenda/agenda-labels';
import { eventPath } from '@/ui/features/agenda/agenda-routes';
import { formatPartLinks } from '@/ui/features/repertoire/repertoire-labels';
import { readingPlaylistErrorMessage } from '@/ui/features/repertoire/reading-playlist-labels';
import {
  readingPlaylistEditPath,
  readingPlaylistsPath,
} from '@/ui/features/repertoire/reading-playlist-routes';
import {
  orgListPageHeightClass,
  orgPageContentClass,
} from '@/ui/layouts/OrgListPageLayout';

type ProgramRowState = {
  programItemId: string;
  pieceId: string;
  pieceTitle: string;
  pieceDeleted: boolean;
  pieceCategory: {
    name: string;
    slug: string;
    color: string | null;
  } | null;
  programNotes: string;
  candidates: PieceFileWithLinks[];
  selectedFileId: string | null;
  skipped: boolean;
};

export function PrepareReadingPlaylistPage() {
  const { orgSlug, eventId } = useParams();
  const navigate = useNavigate();
  const agenda = useAgenda();
  const repertoire = useRepertoire();
  const ensemble = useEnsemble();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((item) => item.slug === orgSlug);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [rows, setRows] = useState<ProgramRowState[]>([]);
  const [parts, setParts] = useState<PartWithDivisions[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('prepare-reading-playlist', isLoading);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backTo = orgSlug && eventId ? eventPath(orgSlug, eventId) : readingPlaylistsPath(orgSlug ?? '');

  useEffect(() => {
    if (!org || !eventId || !userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const orgId = org.id;
    const currentUserId = userId;

    async function load() {
      setIsLoading(true);
      setError(null);

      const eventResult = await agenda.getEvent(orgId, eventId!);
      if (cancelled) {
        return;
      }

      if (!eventResult.ok) {
        setError(agendaErrorMessage(eventResult.error));
        setIsLoading(false);
        return;
      }

      const eventDetail = eventResult.value;
      setEvent(eventDetail);

      const partsResult = await ensemble.listParts(orgId);
      if (!cancelled && partsResult.ok) {
        setParts(partsResult.value);
      }

      let partIds: string[] = [];
      const musicianResult = await ensemble.getMyMusician(orgId, currentUserId);
      if (!cancelled && musicianResult.ok) {
        const assignmentsResult = await ensemble.listAssignmentsForMusician(
          orgId,
          musicianResult.value.id,
        );
        if (assignmentsResult.ok) {
          partIds = assignmentsResult.value
            .map((assignment) => assignment.partId)
            .filter((id): id is string => Boolean(id));
        }
      }
      const nextRows: ProgramRowState[] = [];

      for (const item of eventDetail.program) {
        if (item.pieceDeleted) {
          nextRows.push({
            programItemId: item.id,
            pieceId: item.pieceId,
            pieceTitle: item.pieceTitle,
            pieceDeleted: true,
            pieceCategory: item.pieceCategory,
            programNotes: item.notes ?? '',
            candidates: [],
            selectedFileId: null,
            skipped: true,
          });
          continue;
        }

        const pieceResult = await repertoire.getPiece(orgId, item.pieceId);
        if (!pieceResult.ok) {
          nextRows.push({
            programItemId: item.id,
            pieceId: item.pieceId,
            pieceTitle: item.pieceTitle,
            pieceDeleted: false,
            pieceCategory: item.pieceCategory,
            programNotes: item.notes ?? '',
            candidates: [],
            selectedFileId: null,
            skipped: true,
          });
          continue;
        }

        const candidates = filterScoreCandidatesForUser(pieceResult.value.files, partIds);
        const defaultFile = resolveDefaultScoreFile(candidates);

        nextRows.push({
          programItemId: item.id,
          pieceId: item.pieceId,
          pieceTitle: item.pieceTitle,
          pieceDeleted: false,
          pieceCategory: item.pieceCategory,
          programNotes: item.notes ?? '',
          candidates,
          selectedFileId: defaultFile?.id ?? null,
          skipped: candidates.length === 0,
        });
      }

      if (!cancelled) {
        setRows(nextRows);
        const displayTitle = eventDisplayTitle(eventDetail, {
          name: eventDetail.type.name,
        });
        const dateLabel = formatEventTime(eventDetail.startsAt, eventDetail.endsAt);
        setPlaylistName(`${displayTitle} - ${dateLabel}`);
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [org, eventId, userId, agenda, ensemble, repertoire]);

  const resolvedCount = useMemo(
    () => rows.filter((row) => !row.skipped && row.selectedFileId).length,
    [rows],
  );

  const canSave = useMemo(
    () =>
      playlistName.trim().length > 0 &&
      rows.some((row) => !row.skipped && row.selectedFileId),
    [playlistName, rows],
  );

  function updateRow(programItemId: string, patch: Partial<ProgramRowState>) {
    setRows((current) =>
      current.map((row) =>
        row.programItemId === programItemId ? { ...row, ...patch } : row,
      ),
    );
  }

  async function handleSave() {
    if (!org || !userId || !eventId || !canSave) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const items = rows
      .filter((row) => !row.skipped && row.selectedFileId)
      .map((row) => ({
        pieceFileId: row.selectedFileId!,
        notes: row.programNotes.trim() || null,
      }));

    const result = await repertoire.createReadingPlaylist(org.id, userId, {
      name: playlistName.trim(),
      sourceEventId: eventId,
      items,
    });

    setIsSaving(false);

    if (!result.ok) {
      setError(readingPlaylistErrorMessage(result.error));
      return;
    }

    navigate(readingPlaylistEditPath(orgSlug!, result.value.id));
  }

  if (!orgSlug || !eventId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`${orgPageContentClass} ${orgListPageHeightClass}`}>
        <p className="text-sm text-muted">Carregando programação…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={`${orgPageContentClass} ${orgListPageHeightClass}`}>
        <div className="space-y-4">
          <BackButton fallbackTo={backTo} />
          <p className="text-sm text-muted">{error ?? 'Evento não encontrado.'}</p>
        </div>
      </div>
    );
  }

  const eventTitle = eventDisplayTitle(event, { name: event.type.name });

  return (
    <div className={`${orgPageContentClass} ${orgListPageHeightClass} overflow-y-auto`}>
      <section className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <BackButton fallbackTo={backTo} />
          <div className="min-w-0 flex-1 ml-1">
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Nome da playlist"
              aria-label="Nome da playlist"
              className="w-full bg-transparent text-xl font-semibold text-text outline-none placeholder:text-muted focus:border-b focus:border-primary sm:text-2xl"
            />
            <p className="mt-1 text-sm text-muted">
              {eventTitle} · {resolvedCount} de {rows.length} resolvidas
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">Partituras</h2>

          {rows.length === 0 ? (
            <p className="text-center text-sm text-muted">Nenhuma partitura na programação.</p>
          ) : (
            <ol className="space-y-2">
              {rows.map((row) => {
                const selectedFile =
                  row.candidates.find((file) => file.id === row.selectedFileId) ??
                  row.candidates[0] ??
                  null;

                return (
                  <li
                    key={row.programItemId}
                    className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                  >
                    <div
                      className={`min-w-0 flex-1 ${row.skipped ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-text">
                            {selectedFile && !row.skipped ? selectedFile.title : row.pieceTitle}
                          </p>
                          {selectedFile && !row.skipped && (
                            <p className="text-sm text-muted">
                              {row.pieceTitle}
                              {' · '}
                              {formatPartLinks(selectedFile.partLinks, parts)}
                            </p>
                          )}
                          {row.pieceDeleted && (
                            <p className="mt-0.5 text-xs text-muted">Obra removida do catálogo</p>
                          )}
                          {row.skipped && row.candidates.length === 0 && !row.pieceDeleted && (
                            <p className="mt-0.5 text-sm text-muted">
                              Sem partitura PDF disponível.
                            </p>
                          )}
                        </div>
                        {row.pieceCategory && (
                          <CategoryBadge
                            label={row.pieceCategory.name}
                            color={row.pieceCategory.color}
                            slug={row.pieceCategory.slug}
                            className="shrink-0"
                          />
                        )}
                      </div>

                      {row.programNotes && (
                        <p className="mt-2 rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm text-text">
                          {row.programNotes}
                        </p>
                      )}

                      {!row.skipped && row.candidates.length > 1 && (
                        <select
                          value={row.selectedFileId ?? ''}
                          onChange={(e) =>
                            updateRow(row.programItemId, {
                              selectedFileId: e.target.value || null,
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
                        >
                          <option value="">Selecione a partitura</option>
                          {row.candidates.map((file) => (
                            <option key={file.id} value={file.id}>
                              {file.title} - {formatPartLinks(file.partLinks, parts)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    {row.skipped ? (
                      row.candidates.length > 0 && !row.pieceDeleted ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateRow(row.programItemId, {
                              skipped: false,
                              selectedFileId:
                                row.selectedFileId ?? row.candidates[0]?.id ?? null,
                            })
                          }
                          className="shrink-0 text-muted hover:text-primary"
                          aria-label="Incluir de novo"
                        >
                          <IconPlus className="h-4 w-4" />
                        </button>
                      ) : null
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateRow(row.programItemId, {
                            skipped: true,
                            selectedFileId: null,
                          })
                        }
                        className="shrink-0 text-muted hover:text-red-600"
                        aria-label="Remover"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave || isSaving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? 'Salvando…' : 'Salvar e abrir'}
          </button>
        </div>
      </div>
    </div>
  );
}
