import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PreviousEventProgram } from '@/application/agenda';
import type { EventDetail, ProgramItemDetail, ProgramItemStatus } from '@/domain/agenda';
import type { Result } from '@/domain/shared';
import type { PieceListItem } from '@/domain/repertoire';
import { useRepertoire } from '@/ui/app/AppServicesContext';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { SortableList } from '@/ui/components/SortableList';
import { IconCheck, IconGripVertical, IconPlus, IconTrash, IconPlay } from '@/ui/components/icons';
import { prepareReadingPlaylistPath } from '@/ui/features/repertoire/reading-playlist-routes';
import { repertoirePiecePath } from '@/ui/features/agenda/agenda-routes';
import {
  agendaErrorMessage,
  programItemStatusLabel,
} from '@/ui/features/agenda/agenda-labels';
import { EventProgramPiecePicker } from '@/ui/features/agenda/EventProgramPiecePicker';
import { EventPreviousProgramSection } from '@/ui/features/agenda/EventPreviousProgramSection';

const PROGRAM_ITEM_STATUSES: ProgramItemStatus[] = ['planned', 'performed', 'skipped'];

type ProgramRow = {
  id: string;
  pieceId: string;
  pieceTitle: string;
  pieceDeleted: boolean;
  pieceCategory: {
    name: string;
    slug: string;
    color: string | null;
  } | null;
  notes: string;
  status: ProgramItemStatus;
};

type EventProgramSectionProps = {
  orgSlug: string;
  organizationId: string;
  eventId: string;
  program: ProgramItemDetail[];
  canEditProgram: boolean;
  hideHeading?: boolean;
  recurrenceId?: string | null;
  occurrenceIndex?: number | null;
  onProgramSaved: (program: ProgramItemDetail[]) => void;
  setEventProgram: (
    organizationId: string,
    eventId: string,
    items: { pieceId: string; notes?: string | null; status?: ProgramItemStatus }[],
  ) => Promise<Result<EventDetail>>;
  getPreviousEventProgram?: (
    organizationId: string,
    eventId: string,
  ) => Promise<Result<PreviousEventProgram | null>>;
};

function toRows(program: ProgramItemDetail[]): ProgramRow[] {
  return program.map((item) => ({
    id: item.id,
    pieceId: item.pieceId,
    pieceTitle: item.pieceTitle,
    pieceDeleted: item.pieceDeleted,
    pieceCategory: item.pieceCategory,
    notes: item.notes ?? '',
    status: item.status,
  }));
}

function statusBadgeClassName(status: ProgramItemStatus): string {
  switch (status) {
    case 'performed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'skipped':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    default:
      return 'bg-bg text-muted';
  }
}

function ProgramItemStatusBadge({ status }: { status: ProgramItemStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClassName(status)}`}
    >
      {status === 'performed' && <IconCheck className="h-3 w-3" aria-hidden="true" />}
      {programItemStatusLabel(status)}
    </span>
  );
}

function ProgramItemStatusControl({
  status,
  disabled,
  onChange,
}: {
  status: ProgramItemStatus;
  disabled: boolean;
  onChange: (status: ProgramItemStatus) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-border bg-bg p-0.5"
      role="group"
      aria-label="Status de execução"
    >
      {PROGRAM_ITEM_STATUSES.map((option) => {
        const selected = status === option;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
              selected
                ? 'bg-primary text-white'
                : 'text-muted hover:text-text disabled:hover:text-muted'
            }`}
          >
            {programItemStatusLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

export function EventProgramSection({
  orgSlug,
  organizationId,
  eventId,
  program,
  canEditProgram,
  hideHeading = false,
  recurrenceId = null,
  occurrenceIndex = null,
  onProgramSaved,
  setEventProgram,
  getPreviousEventProgram,
}: EventProgramSectionProps) {
  const repertoire = useRepertoire();
  const [rows, setRows] = useState<ProgramRow[]>(() => toRows(program));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<PieceListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setRows(toRows(program));
    setDirty(false);
  }, [program]);

  const searchPieces = useCallback(
    async (query: string) => {
      setIsSearching(true);
      const result = await repertoire.searchPieces(organizationId, { query: query || undefined });
      if (result.ok) {
        setSearchResults(result.value);
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    },
    [organizationId, repertoire],
  );

  async function saveProgram(nextRows: ProgramRow[]) {
    setIsSaving(true);
    setError(null);
    const result = await setEventProgram(
      organizationId,
      eventId,
      nextRows.map((row) => ({
        pieceId: row.pieceId,
        notes: row.notes.trim() || null,
        status: row.status,
      })),
    );
    setIsSaving(false);

    if (!result.ok) {
      setError(agendaErrorMessage(result.error));
      return false;
    }

    onProgramSaved(result.value.program);
    setDirty(false);
    return true;
  }

  async function handleReorder(nextRows: ProgramRow[]) {
    setRows(nextRows);
    setDirty(true);
    await saveProgram(nextRows);
  }

  async function handleRemove(pieceId: string) {
    const nextRows = rows.filter((row) => row.pieceId !== pieceId);
    setRows(nextRows);
    await saveProgram(nextRows);
  }

  async function handleAdd(pieceId: string) {
    const piece = searchResults.find((item) => item.id === pieceId);
    if (!piece) {
      return;
    }
    const nextRows: ProgramRow[] = [
      ...rows,
      {
        id: `draft-${pieceId}-${Date.now()}`,
        pieceId: piece.id,
        pieceTitle: piece.title,
        pieceDeleted: false,
        pieceCategory: {
          name: piece.category.name,
          slug: piece.category.slug,
          color: piece.category.color,
        },
        notes: '',
        status: 'planned',
      },
    ];
    setRows(nextRows);
    await saveProgram(nextRows);
  }

  async function handleNotesChange(pieceId: string, notes: string) {
    const nextRows = rows.map((row) =>
      row.pieceId === pieceId ? { ...row, notes } : row,
    );
    setRows(nextRows);
    setDirty(true);
  }

  async function handleNotesBlur() {
    if (!dirty) {
      return;
    }
    await saveProgram(rows);
  }

  async function handleStatusChange(pieceId: string, status: ProgramItemStatus) {
    const nextRows = rows.map((row) =>
      row.pieceId === pieceId ? { ...row, status } : row,
    );
    setRows(nextRows);
    await saveProgram(nextRows);
  }

  async function handleIncludePreviousProgram(items: ProgramItemDetail[]) {
    const nextRows: ProgramRow[] = items.map((item, index) => ({
      id: `draft-${item.pieceId}-${Date.now()}-${index}`,
      pieceId: item.pieceId,
      pieceTitle: item.pieceTitle,
      pieceDeleted: false,
      pieceCategory: item.pieceCategory,
      notes: item.notes ?? '',
      status: 'planned',
    }));
    setRows(nextRows);
    return saveProgram(nextRows);
  }

  const showPreviousSection =
    Boolean(recurrenceId) &&
    occurrenceIndex != null &&
    occurrenceIndex > 0 &&
    getPreviousEventProgram;

  return (
    <section className="space-y-3">
      {(canEditProgram || !hideHeading) && (
        <div
          className={`flex items-center gap-3 ${hideHeading ? 'justify-end' : 'justify-between'}`}
        >
          {!hideHeading && <h2 className="text-base font-semibold text-text">Programação</h2>}
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <Link
                to={prepareReadingPlaylistPath(orgSlug, eventId)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text hover:bg-bg"
              >
                <IconPlay className="h-4 w-4" />
                Preparar playlist
              </Link>
            )}
            {canEditProgram && (
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(true);
                  void searchPieces('');
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
              >
                <IconPlus className="h-4 w-4" />
                Peça
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {isSaving && <p className="text-sm text-muted">Salvando programação…</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-muted text-center">Nenhuma obra na programação.</p>
      ) : canEditProgram ? (
        <SortableList
          items={rows}
          onReorder={handleReorder}
          disabled={isSaving}
          ariaLabel="Ordem da programação"
          className="space-y-2"
          renderItem={(row, handle) => (
            <div className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2">
              <button
                type="button"
                className="mt-1 shrink-0 text-muted"
                ref={handle.setActivatorNodeRef}
                {...handle.attributes}
                {...handle.listeners}
                aria-label="Reordenar"
              >
                <IconGripVertical className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Link
                      to={repertoirePiecePath(orgSlug, row.pieceId)}
                      className={`font-medium ${row.pieceDeleted ? 'text-muted line-through' : 'text-text'}`}
                    >
                      {row.pieceTitle}
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemove(row.pieceId)}
                    className="shrink-0 text-muted hover:text-red-600"
                    aria-label="Remover obra"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                </div>
                {row.pieceDeleted && (
                  <p className="mt-0.5 text-xs text-muted">Obra removida do catálogo</p>
                )}
                <div className="mt-2">
                  <ProgramItemStatusControl
                    status={row.status}
                    disabled={isSaving}
                    onChange={(status) => void handleStatusChange(row.pieceId, status)}
                  />
                </div>
                <input
                  type="text"
                  value={row.notes}
                  onChange={(event) => void handleNotesChange(row.pieceId, event.target.value)}
                  onBlur={() => void handleNotesBlur()}
                  placeholder="Notas (opcional)"
                  className="mt-2 w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text"
                />
              </div>
            </div>
          )}
        />
      ) : (
        <ol className="space-y-2">
          {rows.map((row) => {
            const cardContent = (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`font-medium ${row.pieceDeleted ? 'text-muted line-through' : 'text-text'}`}
                    >
                      {row.pieceTitle}
                    </p>
                    <ProgramItemStatusBadge status={row.status} />
                  </div>
                  {row.pieceDeleted && (
                    <p className="mt-0.5 text-xs text-muted">Obra removida do catálogo</p>
                  )}
                  {row.notes && <p className="mt-1 text-sm text-muted">{row.notes}</p>}
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
            );

            return (
              <li
                key={row.id}
                className={row.status === 'skipped' ? 'opacity-60' : undefined}
              >
                {row.pieceDeleted ? (
                  <div className="rounded-xl border border-border bg-surface px-4 py-3">
                    {cardContent}
                  </div>
                ) : (
                  <Link
                    to={repertoirePiecePath(orgSlug, row.pieceId)}
                    className="block rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-bg"
                  >
                    {cardContent}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <EventProgramPiecePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        pieces={searchResults}
        excludedPieceIds={rows.map((row) => row.pieceId)}
        onSearch={searchPieces}
        isSearching={isSearching}
        onSelect={(pieceId) => void handleAdd(pieceId)}
      />

      {showPreviousSection && (
        <EventPreviousProgramSection
          orgSlug={orgSlug}
          organizationId={organizationId}
          eventId={eventId}
          recurrenceId={recurrenceId!}
          occurrenceIndex={occurrenceIndex!}
          canEditProgram={canEditProgram}
          isSaving={isSaving}
          getPreviousEventProgram={getPreviousEventProgram!}
          onInclude={handleIncludePreviousProgram}
        />
      )}
    </section>
  );
}
