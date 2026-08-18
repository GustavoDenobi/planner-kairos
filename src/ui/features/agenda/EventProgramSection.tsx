import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventDetail, ProgramItemDetail } from '@/domain/agenda';
import type { Result } from '@/domain/shared';
import type { PieceListItem } from '@/domain/repertoire';
import { useRepertoire } from '@/ui/app/AppServicesContext';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { SortableList } from '@/ui/components/SortableList';
import { IconGripVertical, IconPlus, IconTrash } from '@/ui/components/icons';
import { prepareReadingPlaylistPath } from '@/ui/features/repertoire/reading-playlist-routes';
import { repertoirePiecePath } from '@/ui/features/agenda/agenda-routes';
import { agendaErrorMessage } from '@/ui/features/agenda/agenda-labels';
import { EventProgramPiecePicker } from '@/ui/features/agenda/EventProgramPiecePicker';

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
};

type EventProgramSectionProps = {
  orgSlug: string;
  organizationId: string;
  eventId: string;
  program: ProgramItemDetail[];
  isAdmin: boolean;
  hideHeading?: boolean;
  onProgramSaved: (program: ProgramItemDetail[]) => void;
  setEventProgram: (
    organizationId: string,
    eventId: string,
    items: { pieceId: string; notes?: string | null }[],
  ) => Promise<Result<EventDetail>>;
};

function toRows(program: ProgramItemDetail[]): ProgramRow[] {
  return program.map((item) => ({
    id: item.id,
    pieceId: item.pieceId,
    pieceTitle: item.pieceTitle,
    pieceDeleted: item.pieceDeleted,
    pieceCategory: item.pieceCategory,
    notes: item.notes ?? '',
  }));
}

export function EventProgramSection({
  orgSlug,
  organizationId,
  eventId,
  program,
  isAdmin,
  hideHeading = false,
  onProgramSaved,
  setEventProgram,
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

  return (
    <section className="space-y-3">
      {(isAdmin || !hideHeading) && (
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
                Preparar partituras
              </Link>
            )}
            {isAdmin && (
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
      ) : isAdmin ? (
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
                  <div className="flex min-w-0 items-center gap-1.5">
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
                  <div className="flex items-center gap-2">
                    <p
                      className={`font-medium ${row.pieceDeleted ? 'text-muted line-through' : 'text-text'}`}
                    >
                      {row.pieceTitle}
                    </p>
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
              <li key={row.id}>
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
    </section>
  );
}
