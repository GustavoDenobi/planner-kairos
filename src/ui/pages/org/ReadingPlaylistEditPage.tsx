import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import type {
  PieceFilePartLink,
  PieceFileWithLinks,
  PieceListItem,
  ReadingPlaylistItemDetail,
  ReadingPlaylistPieceCategory,
} from '@/domain/repertoire';
import { filterScoreCandidatesForUser } from '@/domain/repertoire';
import { useEnsemble, useRepertoire } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { BackButton } from '@/ui/components/BackButton';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { Modal } from '@/ui/components/Modal';
import { SortableDragHandle, SortableList } from '@/ui/components/SortableList';
import { IconPlay, IconPlus, IconTrash } from '@/ui/components/icons';
import { formatPartLinks } from '@/ui/features/repertoire/repertoire-labels';
import { readingPlaylistErrorMessage } from '@/ui/features/repertoire/reading-playlist-labels';
import {
  readingPlaylistReaderPath,
  readingPlaylistsPath,
} from '@/ui/features/repertoire/reading-playlist-routes';
import {
  orgListPageHeightClass,
  orgPageContentClass,
} from '@/ui/layouts/OrgListPageLayout';
import { OfflinePlaylistDownloadButton } from '@/ui/features/pwa/OfflineDownloadButton';

type EditableItem = {
  id: string;
  pieceFileId: string;
  pieceId: string;
  pieceTitle: string;
  fileTitle: string;
  notes: string;
  pieceCategory: ReadingPlaylistPieceCategory | null;
  partLinks: PieceFilePartLink[];
};

type PlaylistSnapshot = {
  name: string;
  items: { pieceFileId: string; notes: string }[];
};

const EMPTY_SNAPSHOT: PlaylistSnapshot = { name: '', items: [] };
const AUTO_SAVE_DEBOUNCE_MS = 500;

function toSnapshot(name: string, items: EditableItem[]): PlaylistSnapshot {
  return {
    name: name.trim(),
    items: items.map((item) => ({
      pieceFileId: item.pieceFileId,
      notes: item.notes.trim(),
    })),
  };
}

function snapshotsEqual(left: PlaylistSnapshot, right: PlaylistSnapshot): boolean {
  if (left.name !== right.name || left.items.length !== right.items.length) {
    return false;
  }
  return left.items.every(
    (item, index) =>
      item.pieceFileId === right.items[index]?.pieceFileId &&
      item.notes === right.items[index]?.notes,
  );
}

export function ReadingPlaylistNewPage() {
  const { orgSlug } = useParams();
  const repertoire = useRepertoire();
  const ensemble = useEnsemble();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((item) => item.slug === orgSlug);

  const [name, setName] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [parts, setParts] = useState<PartWithDivisions[]>([]);
  const [userPartIds, setUserPartIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(
    () => !snapshotsEqual(toSnapshot(name, items), EMPTY_SNAPSHOT),
    [name, items],
  );

  useEffect(() => {
    if (!org || !userId) {
      return;
    }

    void ensemble.listParts(org.id).then((result) => {
      if (result.ok) {
        setParts(result.value);
      }
    });

    void ensemble.getMyMusician(org.id, userId).then(async (musicianResult) => {
      if (!musicianResult.ok) {
        return;
      }
      const assignmentsResult = await ensemble.listAssignmentsForMusician(
        org.id,
        musicianResult.value.id,
      );
      if (assignmentsResult.ok) {
        setUserPartIds(
          assignmentsResult.value
            .map((assignment) => assignment.partId)
            .filter((id): id is string => Boolean(id)),
        );
      }
    });
  }, [org, userId, ensemble]);

  async function handleSave(): Promise<boolean> {
    if (!org || !userId || !orgSlug) {
      return false;
    }

    setIsSaving(true);
    setError(null);

    const result = await repertoire.createReadingPlaylist(org.id, userId, {
      name: name.trim(),
      items: items.map((item) => ({
        pieceFileId: item.pieceFileId,
        notes: item.notes.trim() || null,
      })),
    });

    setIsSaving(false);

    if (!result.ok) {
      setError(readingPlaylistErrorMessage(result.error));
      return false;
    }

    return true;
  }

  function handleAddFile(
    file: PieceFileWithLinks,
    pieceTitle: string,
    pieceCategory: ReadingPlaylistPieceCategory | null,
  ) {
    setItems((current) => [
      ...current,
      {
        id: `draft-${file.id}-${Date.now()}`,
        pieceFileId: file.id,
        pieceId: file.pieceId,
        pieceTitle,
        fileTitle: file.title,
        notes: '',
        pieceCategory,
        partLinks: file.partLinks,
      },
    ]);
    setPickerOpen(false);
  }

  if (!orgSlug) {
    return null;
  }

  return (
    <PlaylistEditorShell
      title="Nova playlist"
      backTo={readingPlaylistsPath(orgSlug)}
      name={name}
      onNameChange={setName}
      items={items}
      parts={parts}
      onReorder={setItems}
      onRemove={(id) => setItems((current) => current.filter((item) => item.id !== id))}
      onAddClick={() => setPickerOpen(true)}
      onSave={handleSave}
      isSaving={isSaving}
      error={error}
      isDirty={isDirty}
      canSave={isDirty && name.trim().length > 0 && items.length > 0}
      pickerOpen={pickerOpen}
      onPickerClose={() => setPickerOpen(false)}
      onAddFile={handleAddFile}
      orgId={org?.id ?? ''}
      userPartIds={userPartIds}
      repertoire={repertoire}
    />
  );
}

export function ReadingPlaylistEditPage() {
  const { orgSlug, playlistId } = useParams();
  const navigate = useNavigate();
  const repertoire = useRepertoire();
  const ensemble = useEnsemble();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((item) => item.slug === orgSlug);

  const [name, setName] = useState('');
  const [sourceEventId, setSourceEventId] = useState<string | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [parts, setParts] = useState<PartWithDivisions[]>([]);
  const [userPartIds, setUserPartIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('reading-playlist-edit', isLoading);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<PlaylistSnapshot | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const loadPlaylist = useCallback(async () => {
    if (!org || !userId || !playlistId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await repertoire.getReadingPlaylist(org.id, playlistId, userId);
    if (!result.ok) {
      setError(readingPlaylistErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    const playlist = result.value;
    setName(playlist.name);
    setSourceEventId(playlist.sourceEventId);
    const nextItems = playlist.items.map((item: ReadingPlaylistItemDetail) => ({
      id: item.id,
      pieceFileId: item.pieceFileId,
      pieceId: item.pieceId,
      pieceTitle: item.pieceTitle,
      fileTitle: item.fileTitle,
      notes: item.notes ?? '',
      pieceCategory: item.pieceCategory,
      partLinks: item.partLinks,
    }));
    setItems(nextItems);
    setBaseline(toSnapshot(playlist.name, nextItems));
    setIsLoading(false);
  }, [org, userId, playlistId, repertoire]);

  useEffect(() => {
    void loadPlaylist();
  }, [loadPlaylist]);

  useEffect(() => {
    if (!org || !userId) {
      return;
    }

    void ensemble.listParts(org.id).then((result) => {
      if (result.ok) {
        setParts(result.value);
      }
    });

    void ensemble.getMyMusician(org.id, userId).then(async (musicianResult) => {
      if (!musicianResult.ok) {
        return;
      }
      const assignmentsResult = await ensemble.listAssignmentsForMusician(
        org.id,
        musicianResult.value.id,
      );
      if (assignmentsResult.ok) {
        setUserPartIds(
          assignmentsResult.value
            .map((assignment) => assignment.partId)
            .filter((id): id is string => Boolean(id)),
        );
      }
    });
  }, [org, userId, ensemble]);

  const isDirty = useMemo(
    () => baseline !== null && !snapshotsEqual(toSnapshot(name, items), baseline),
    [baseline, name, items],
  );

  const persistChanges = useCallback(
    async (overrides?: { name?: string; items?: EditableItem[] }): Promise<boolean> => {
      if (!org || !userId || !playlistId || baseline === null) {
        return false;
      }

      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      const nextName = overrides?.name ?? name;
      const nextItems = overrides?.items ?? items;
      const snapshot = toSnapshot(nextName, nextItems);
      if (snapshotsEqual(snapshot, baseline)) {
        return true;
      }

      if (snapshot.name.length === 0) {
        return false;
      }

      const nameChanged = snapshot.name !== baseline.name;
      const itemsChanged = !snapshotsEqual(
        { name: '', items: snapshot.items },
        { name: '', items: baseline.items },
      );

      if (!nameChanged && itemsChanged && nextItems.length === 0) {
        return false;
      }

      setIsSaving(true);
      setError(null);

      let nextBaseline = baseline;

      if (nameChanged) {
        const nameResult = await repertoire.updateReadingPlaylist(org.id, playlistId, userId, {
          name: snapshot.name,
        });

        if (!nameResult.ok) {
          setIsSaving(false);
          setError(readingPlaylistErrorMessage(nameResult.error));
          return false;
        }

        nextBaseline = { ...nextBaseline, name: snapshot.name };
      }

      if (itemsChanged && nextItems.length > 0) {
        const itemsResult = await repertoire.replaceReadingPlaylistItems(
          org.id,
          playlistId,
          userId,
          nextItems.map((item) => ({
            pieceFileId: item.pieceFileId,
            notes: item.notes.trim() || null,
          })),
        );

        if (!itemsResult.ok) {
          setIsSaving(false);
          setError(readingPlaylistErrorMessage(itemsResult.error));
          return false;
        }

        nextBaseline = snapshot;
      }

      setBaseline(nextBaseline);
      setIsSaving(false);
      return true;
    },
    [org, userId, playlistId, baseline, name, items, repertoire],
  );

  useEffect(() => {
    if (baseline === null || isLoading) {
      return;
    }

    if (name.trim() === baseline.name) {
      return;
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      void persistChanges();
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [name, baseline, isLoading, persistChanges]);

  async function handleDelete(): Promise<boolean> {
    if (!org || !userId || !playlistId || !orgSlug) {
      return false;
    }

    setIsSaving(true);
    const result = await repertoire.deleteReadingPlaylist(org.id, playlistId, userId);
    setIsSaving(false);

    if (!result.ok) {
      setError(readingPlaylistErrorMessage(result.error));
      return false;
    }

    navigate(readingPlaylistsPath(orgSlug));
    return true;
  }

  function handleReorder(nextItems: EditableItem[]) {
    setItems(nextItems);
    void persistChanges({ items: nextItems });
  }

  function handleRemove(id: string) {
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    void persistChanges({ items: nextItems });
  }

  function handleAddFile(
    file: PieceFileWithLinks,
    pieceTitle: string,
    pieceCategory: ReadingPlaylistPieceCategory | null,
  ) {
    const nextItems = [
      ...items,
      {
        id: `draft-${file.id}-${Date.now()}`,
        pieceFileId: file.id,
        pieceId: file.pieceId,
        pieceTitle,
        fileTitle: file.title,
        notes: '',
        pieceCategory,
        partLinks: file.partLinks,
      },
    ];
    setItems(nextItems);
    setPickerOpen(false);
    void persistChanges({ items: nextItems });
  }

  if (!orgSlug || !playlistId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`${orgPageContentClass} ${orgListPageHeightClass}`}>
        <p className="text-sm text-muted">Carregando…</p>
      </div>
    );
  }

  return (
    <PlaylistEditorShell
      title="Editar playlist"
      backTo={readingPlaylistsPath(orgSlug)}
      name={name}
      onNameChange={setName}
      items={items}
      parts={parts}
      onReorder={handleReorder}
      onRemove={handleRemove}
      onAddClick={() => setPickerOpen(true)}
      onSave={persistChanges}
      onDelete={handleDelete}
      onOpenReader={
        items.length > 0
          ? () => navigate(readingPlaylistReaderPath(orgSlug, playlistId, 0))
          : undefined
      }
      playlistId={playlistId}
      userId={userId ?? ''}
      autoSave
      isSaving={isSaving}
      error={error}
      isDirty={isDirty}
      canSave={isDirty && name.trim().length > 0 && items.length > 0}
      sourceEventId={sourceEventId}
      pickerOpen={pickerOpen}
      onPickerClose={() => setPickerOpen(false)}
      onAddFile={handleAddFile}
      orgId={org?.id ?? ''}
      userPartIds={userPartIds}
      repertoire={repertoire}
    />
  );
}

type PlaylistEditorShellProps = {
  title: string;
  backTo: string;
  name: string;
  onNameChange: (name: string) => void;
  items: EditableItem[];
  parts: PartWithDivisions[];
  onReorder: (items: EditableItem[]) => void;
  onRemove: (id: string) => void;
  onAddClick: () => void;
  onSave: (overrides?: { name?: string; items?: EditableItem[] }) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onOpenReader?: () => void;
  playlistId?: string;
  userId?: string;
  autoSave?: boolean;
  isSaving: boolean;
  error: string | null;
  isDirty: boolean;
  canSave: boolean;
  sourceEventId?: string | null;
  pickerOpen: boolean;
  onPickerClose: () => void;
  onAddFile: (
    file: PieceFileWithLinks,
    pieceTitle: string,
    pieceCategory: ReadingPlaylistPieceCategory | null,
  ) => void;
  orgId: string;
  userPartIds: string[];
  repertoire: ReturnType<typeof useRepertoire>;
};

function PlaylistEditorShell({
  title,
  backTo,
  name,
  onNameChange,
  items,
  parts,
  onReorder,
  onRemove,
  onAddClick,
  onSave,
  onDelete,
  onOpenReader,
  playlistId,
  userId,
  autoSave = false,
  isSaving,
  error,
  isDirty,
  canSave,
  sourceEventId,
  pickerOpen,
  onPickerClose,
  onAddFile,
  orgId,
  userPartIds,
  repertoire,
}: PlaylistEditorShellProps) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const heading = name.trim() || title;
  const bypassBlockRef = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !bypassBlockRef.current &&
      isDirty &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (isDirty) {
      bypassBlockRef.current = false;
    }
  }, [isDirty]);

  useEffect(() => {
    if (!autoSave || blocker.state !== 'blocked') {
      return;
    }

    void (async () => {
      const saved = await onSave();
      if (saved) {
        allowLeave();
        blocker.proceed();
        return;
      }

      if (blocker.state === 'blocked') {
        blocker.reset();
      }
    })();
  }, [autoSave, blocker.state, onSave]);

  useEffect(() => {
    if (autoSave || !isDirty) {
      return;
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, autoSave]);

  function allowLeave() {
    bypassBlockRef.current = true;
  }

  async function handleSaveClick() {
    const saved = await onSave();
    if (!saved) {
      return;
    }
    allowLeave();
    navigate(backTo);
  }

  async function handleSaveAndLeave() {
    const saved = await onSave();
    if (!saved) {
      return;
    }
    allowLeave();
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }

  function handleDiscardAndLeave() {
    allowLeave();
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }

  async function handleConfirmDelete() {
    if (!onDelete) {
      return;
    }
    allowLeave();
    const removed = await onDelete();
    if (!removed) {
      bypassBlockRef.current = false;
    }
  }

  const leaveOpen = !autoSave && blocker.state === 'blocked';

  return (
    <div className={`flex flex-col ${orgPageContentClass} ${orgListPageHeightClass}`}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <section className="mb-6 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <BackButton fallbackTo={backTo} />
            <div className="min-w-0 flex-1 ml-1">
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder={title}
                aria-label="Nome da playlist"
                className="w-full bg-transparent text-xl font-semibold text-text outline-none placeholder:text-muted focus:border-b focus:border-primary sm:text-2xl"
              />
              {sourceEventId && (
                <p className="mt-1 text-sm text-muted">Importado de um evento</p>
              )}
            </div>
            {onOpenReader && (
              <button
                type="button"
                onClick={onOpenReader}
                aria-label="Abrir leitor"
                className="flex shrink-0 items-center justify-center rounded-lg border border-border p-2 text-primary transition-colors hover:bg-bg"
              >
                <IconPlay className="h-4 w-4" />
              </button>
            )}
            {playlistId && userId && orgId && items.length > 0 && (
              <OfflinePlaylistDownloadButton
                organizationId={orgId}
                playlistId={playlistId}
                userId={userId}
                pieceFileIds={items.map((item) => item.pieceFileId)}
              />
            )}
          </div>
        </section>

        <div className="space-y-6">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {autoSave && isSaving && (
            <p className="text-sm text-muted">Salvando alterações…</p>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-text">Partituras</h2>
            </div>

            {items.length === 0 ? (
              <p className="text-center text-sm text-muted">Nenhuma partitura na playlist.</p>
            ) : (
              <SortableList
                items={items}
                onReorder={onReorder}
                ariaLabel="Ordem das partituras"
                className="space-y-2"
                renderItem={(item, handle) => (
                  <div className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2">
                    <SortableDragHandle {...handle} label="Reordenar" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-text">{item.fileTitle}</p>
                          <p className="text-sm text-muted">{item.pieceTitle}</p>
                          <p className="mt-0.5 text-sm text-muted">
                            {formatPartLinks(item.partLinks, parts)}
                          </p>
                        </div>
                        {item.pieceCategory && (
                          <CategoryBadge
                            label={item.pieceCategory.name}
                            color={item.pieceCategory.color}
                            slug={item.pieceCategory.slug}
                            className="shrink-0"
                          />
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="shrink-0 text-muted hover:text-red-600"
                      aria-label="Remover"
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                )}
              />
            )}

            <div className="flex justify-center">
              <button
                type="button"
                onClick={onAddClick}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                <IconPlus className="h-4 w-4" />
                Partitura
              </button>
            </div>
          </section>

          {!autoSave && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveClick()}
                disabled={!canSave || isSaving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {onDelete && (
        <div className="shrink-0 border-t border-border pt-4 md:flex md:justify-end">
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={isSaving}
            className="w-full rounded-lg border border-red-600/40 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-600/10 disabled:opacity-50 md:w-auto"
          >
            Excluir playlist
          </button>
        </div>
      )}

      {onDelete && (
        <Modal
          open={deleteOpen}
          onClose={() => !isSaving && setDeleteOpen(false)}
          title="Excluir playlist?"
        >
          <p className="text-sm text-muted">
            A playlist &nbsp;<strong className="text-text">{heading}</strong>&nbsp; será
            removida permanentemente.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setDeleteOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleConfirmDelete()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? 'Excluindo…' : 'Excluir playlist'}
            </button>
          </div>
        </Modal>
      )}

      <Modal
        open={leaveOpen}
        onClose={() => {
          if (!isSaving && blocker.state === 'blocked') {
            blocker.reset();
          }
        }}
        title="Sair sem salvar?"
      >
        <p className="text-sm text-muted">
          Há alterações que ainda não foram salvas.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => blocker.state === 'blocked' && blocker.reset()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-50"
          >
            Continuar editando
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleDiscardAndLeave}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-bg hover:text-text disabled:opacity-50"
          >
            Sair sem salvar
          </button>
          <button
            type="button"
            disabled={!canSave || isSaving}
            onClick={() => void handleSaveAndLeave()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Modal>

      <AddScoreFileModal
        open={pickerOpen}
        onClose={onPickerClose}
        orgId={orgId}
        userPartIds={userPartIds}
        parts={parts}
        repertoire={repertoire}
        excludedFileIds={items.map((item) => item.pieceFileId)}
        onSelect={onAddFile}
      />
    </div>
  );
}

type AddScoreFileModalProps = {
  open: boolean;
  onClose: () => void;
  orgId: string;
  userPartIds: string[];
  parts: PartWithDivisions[];
  repertoire: ReturnType<typeof useRepertoire>;
  excludedFileIds: string[];
  onSelect: (
    file: PieceFileWithLinks,
    pieceTitle: string,
    pieceCategory: ReadingPlaylistPieceCategory | null,
  ) => void;
};

function AddScoreFileModal({
  open,
  onClose,
  orgId,
  userPartIds,
  parts,
  repertoire,
  excludedFileIds,
  onSelect,
}: AddScoreFileModalProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [pieceTitle, setPieceTitle] = useState('');
  const [pieceCategory, setPieceCategory] = useState<ReadingPlaylistPieceCategory | null>(
    null,
  );
  const [scoreFiles, setScoreFiles] = useState<PieceFileWithLinks[]>([]);
  const [searchResults, setSearchResults] = useState<PieceListItem[]>([]);

  const excluded = useMemo(() => new Set(excludedFileIds), [excludedFileIds]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedPieceId(null);
      setScoreFiles([]);
      setSearchResults([]);
      setPieceTitle('');
      setPieceCategory(null);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      const result = await repertoire.searchPieces(orgId, { query: query || undefined });
      if (result.ok) {
        setSearchResults(result.value);
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [open, query, orgId, repertoire]);

  async function handleSelectPiece(pieceId: string, title: string) {
    setSelectedPieceId(pieceId);
    setPieceTitle(title);
    const result = await repertoire.getPiece(orgId, pieceId);
    if (result.ok) {
      const candidates = filterScoreCandidatesForUser(result.value.files, userPartIds);
      setScoreFiles(candidates.filter((file) => !excluded.has(file.id)));
      setPieceCategory({
        name: result.value.category.name,
        slug: result.value.category.slug,
        color: result.value.category.color,
      });
    } else {
      setScoreFiles([]);
      setPieceCategory(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar partitura">
      <div className="space-y-3">
        {!selectedPieceId ? (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar obra"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
              autoFocus
            />
            {isSearching ? (
              <p className="text-sm text-muted">Buscando…</p>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma obra encontrada.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {searchResults.map((piece) => (
                  <li key={piece.id}>
                    <button
                      type="button"
                      onClick={() => void handleSelectPiece(piece.id, piece.title)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg"
                    >
                      <span className="font-medium text-text">{piece.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-text">
              Obra: <span className="font-medium">{pieceTitle}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedPieceId(null);
                setScoreFiles([]);
                setPieceCategory(null);
              }}
              className="text-sm text-primary hover:underline"
            >
              Escolher outra obra
            </button>
            {scoreFiles.length === 0 ? (
              <p className="text-sm text-muted">Sem partituras disponíveis para adicionar.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {scoreFiles.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(file, pieceTitle, pieceCategory)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg"
                    >
                      <span className="font-medium text-text">{file.title}</span>
                      <span className="ml-2 text-muted">
                        {formatPartLinks(file.partLinks, parts)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
