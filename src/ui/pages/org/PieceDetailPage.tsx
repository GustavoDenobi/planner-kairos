import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { defaultPieceFileTitle } from '@/domain/repertoire';
import type {
  PieceCategory,
  PieceDetail,
  PieceFilePartLink,
  PieceFileWithLinks,
  PieceTheme,
} from '@/domain/repertoire';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { computeFileSha256Hex } from '@/domain/shared';
import { useEnsemble, useRepertoire } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { Modal } from '@/ui/components/Modal';
import { BackButton } from '@/ui/components/BackButton';
import { IconPencil, IconTrash, IconArrowDown } from '@/ui/components/icons';
import { PieceAliasesField } from '@/ui/features/repertoire/PieceAliasesField';
import { PieceFilesSection } from '@/ui/features/repertoire/PieceFilesSection';
import {
  PieceFileUploadEntries,
  type PartLinkSelection,
  type UploadFileEntry,
} from '@/ui/features/repertoire/PieceFileUploadEntries';
import { repertoirePath } from '@/ui/features/repertoire/repertoire-routes';
import { orgListPageHeightClass } from '@/ui/layouts/OrgListPageLayout';
import {
  formatPartLinks,
  pieceFileKindLabel,
  repertoireErrorMessage,
} from '@/ui/features/repertoire/repertoire-labels';

export function PieceDetailPage() {
  const { orgSlug, pieceId } = useParams();
  const navigate = useNavigate();
  const repertoire = useRepertoire();
  const ensemble = useEnsemble();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);

  const [piece, setPiece] = useState<PieceDetail | null>(null);
  const [parts, setParts] = useState<PartWithDivisions[]>([]);
  const [categories, setCategories] = useState<PieceCategory[]>([]);
  const [themes, setThemes] = useState<PieceTheme[]>([]);
  const [userPartIds, setUserPartIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [fichaExpanded, setFichaExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPreparingUpload, setIsPreparingUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadEntries, setUploadEntries] = useState<UploadFileEntry[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  );

  const [editingFile, setEditingFile] = useState<PieceFileWithLinks | null>(null);
  const [editFileTitle, setEditFileTitle] = useState('');
  const [editFilePartLinks, setEditFilePartLinks] = useState<PartLinkSelection[]>([]);
  const [editFileError, setEditFileError] = useState<string | null>(null);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [isRemovingFile, setIsRemovingFile] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';

  const hasCollapsibleContent = useMemo(() => {
    if (!piece) {
      return false;
    }
    return Boolean(
      piece.composer ||
        piece.themes.length > 0 ||
        piece.description ||
        piece.notes ||
        piece.aliases.length > 0 ||
        isAdmin,
    );
  }, [piece, isAdmin]);

  useEffect(() => {
    if (editingFile) {
      setEditFileTitle(editingFile.title);
      setEditFilePartLinks(
        editingFile.partLinks.map((link) => ({
          partId: link.partId,
          partDivisionId: link.partDivisionId,
        })),
      );
      setEditFileError(null);
    }
  }, [editingFile]);

  async function loadMemberParts() {
    if (!org || !userId || isAdmin) {
      setUserPartIds([]);
      return;
    }

    const musicianResult = await ensemble.getMyMusician(org.id, userId);
    if (!musicianResult.ok) {
      setUserPartIds([]);
      return;
    }

    const assignmentsResult = await ensemble.listAssignmentsForMusician(
      org.id,
      musicianResult.value.id,
    );

    const partIds: string[] = [];
    const seen = new Set<string>();

    if (assignmentsResult.ok) {
      for (const assignment of assignmentsResult.value) {
        if (!assignment.partId || seen.has(assignment.partId)) {
          continue;
        }
        seen.add(assignment.partId);
        partIds.push(assignment.partId);
      }
    }

    setUserPartIds(partIds);
  }

  async function loadPiece() {
    if (!org || !pieceId) {
      return;
    }

    setIsLoading(true);
    const [pieceResult, categoriesResult, themesResult, partsResult] = await Promise.all([
      repertoire.getPiece(org.id, pieceId),
      repertoire.listPieceCategories(org.id),
      repertoire.listPieceThemes(org.id),
      ensemble.listParts(org.id),
    ]);

    if (pieceResult.ok) {
      setPiece(pieceResult.value);
      setTitle(pieceResult.value.title);
      setComposer(pieceResult.value.composer ?? '');
      setAliases(pieceResult.value.aliases);
      setCategoryId(pieceResult.value.categoryId);
      setDescription(pieceResult.value.description ?? '');
      setNotes(pieceResult.value.notes ?? '');
      setSelectedThemeIds(pieceResult.value.themes.map((theme) => theme.id));
    } else {
      setPiece(null);
    }

    if (categoriesResult.ok) {
      setCategories(categoriesResult.value);
    }
    if (themesResult.ok) {
      setThemes(themesResult.value);
    }
    if (partsResult.ok) {
      setParts(partsResult.value);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    loadPiece();
    loadMemberParts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, pieceId, userId, isAdmin]);

  if (!org || !pieceId) {
    return null;
  }

  if (isLoading) {
    return <p className="text-sm text-muted">Carregando…</p>;
  }

  if (!piece) {
    return (
      <div className="space-y-4">
        <BackButton fallbackTo={repertoirePath(orgSlug!, 'pieces')} />
        <p className="text-sm text-muted">Obra não encontrada.</p>
      </div>
    );
  }

  function resetEditForm() {
    setTitle(piece!.title);
    setComposer(piece!.composer ?? '');
    setAliases(piece!.aliases);
    setCategoryId(piece!.categoryId);
    setDescription(piece!.description ?? '');
    setNotes(piece!.notes ?? '');
    setSelectedThemeIds(piece!.themes.map((theme) => theme.id));
    setError(null);
  }

  function openEditModal() {
    resetEditForm();
    setEditOpen(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const result = await repertoire.updatePiece(org.id, piece.id, {
      title,
      categoryId,
      composer: composer || null,
      description: description || null,
      notes: notes || null,
      aliases,
      themeIds: selectedThemeIds,
    });

    setIsSaving(false);

    if (!result.ok) {
      setError(repertoireErrorMessage(result.error));
      return;
    }

    setPiece(result.value);
    setEditOpen(false);
  }

  function toggleTheme(themeId: string) {
    setSelectedThemeIds((prev) =>
      prev.includes(themeId) ? prev.filter((id) => id !== themeId) : [...prev, themeId],
    );
  }

  function partLinkKey(link: PartLinkSelection): string {
    return `${link.partId}:${link.partDivisionId ?? 'all'}`;
  }

  function isPartLinkSelectedIn(
    links: PartLinkSelection[],
    partId: string,
    partDivisionId: string | null,
  ): boolean {
    return links.some(
      (link) => link.partId === partId && link.partDivisionId === partDivisionId,
    );
  }

  function togglePartLinkIn(
    setLinks: React.Dispatch<React.SetStateAction<PartLinkSelection[]>>,
    partId: string,
    partDivisionId: string | null,
  ) {
    const key = partLinkKey({ partId, partDivisionId });
    setLinks((prev) => {
      const exists = prev.some((link) => partLinkKey(link) === key);
      if (exists) {
        return prev.filter((link) => partLinkKey(link) !== key);
      }
      return [...prev, { partId, partDivisionId }];
    });
  }

  function partLinksEqual(
    current: PartLinkSelection[],
    original: PieceFilePartLink[],
  ): boolean {
    if (current.length !== original.length) {
      return false;
    }
    const originalKeys = new Set(
      original.map((link) => partLinkKey({ partId: link.partId, partDivisionId: link.partDivisionId })),
    );
    return current.every((link) => originalKeys.has(partLinkKey(link)));
  }

  async function handleAddFiles(files: File[]) {
    setUploadError(null);
    setIsPreparingUpload(true);

    try {
      const existingTitleByHash = new Map<string, string>();
      for (const existing of piece.files) {
        if (existing.contentHash && !existingTitleByHash.has(existing.contentHash)) {
          existingTitleByHash.set(existing.contentHash, existing.title);
        }
      }

      const accepted: UploadFileEntry[] = [];

      for (const file of files) {
        const contentHash = await computeFileSha256Hex(file);
        accepted.push({
          id: crypto.randomUUID(),
          file,
          title: defaultPieceFileTitle(file.name),
          partLinks: [],
          contentHash,
          duplicateOfTitle: existingTitleByHash.get(contentHash) ?? null,
        });
      }

      setUploadEntries(accepted);
      setUploadOpen(true);
    } finally {
      setIsPreparingUpload(false);
    }
  }

  function updateUploadEntry(
    id: string,
    patch: Partial<Pick<UploadFileEntry, 'title' | 'partLinks'>>,
  ) {
    setUploadEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  function removeUploadEntry(id: string) {
    setUploadEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      if (next.length === 0) {
        setUploadOpen(false);
      }
      return next;
    });
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (uploadEntries.length === 0) {
      setUploadError('Selecione um arquivo.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress({ current: 0, total: uploadEntries.length });

    for (let index = 0; index < uploadEntries.length; index++) {
      const entry = uploadEntries[index];
      setUploadProgress({ current: index + 1, total: uploadEntries.length });

      const partLinks: PieceFilePartLink[] = entry.partLinks.map((link) => ({
        partId: link.partId,
        partDivisionId: link.partDivisionId,
      }));

      const result = await repertoire.attachPieceFile(org.id, {
        pieceId: piece.id,
        file: entry.file,
        title: entry.title,
        partLinks: entry.file.type === 'application/pdf' ? partLinks : [],
        contentHash: entry.contentHash,
      });

      if (!result.ok) {
        setUploadError(`${entry.file.name}: ${repertoireErrorMessage(result.error)}`);
        setIsUploading(false);
        setUploadProgress(null);
        return;
      }
    }

    setIsUploading(false);
    setUploadProgress(null);
    setUploadOpen(false);
    setUploadEntries([]);
    await loadPiece();
  }

  async function handleSaveFile() {
    if (!editingFile) {
      return;
    }

    setEditFileError(null);
    setIsSavingFile(true);

    const partLinks: PieceFilePartLink[] = editFilePartLinks.map((link) => ({
      partId: link.partId,
      partDivisionId: link.partDivisionId,
    }));

    const result = await repertoire.updatePieceFile(org.id, piece.id, editingFile.id, {
      title: editFileTitle,
      partLinks: editingFile.kind === 'score' ? partLinks : undefined,
    });

    setIsSavingFile(false);

    if (!result.ok) {
      setEditFileError(repertoireErrorMessage(result.error));
      return;
    }

    setEditingFile(result.value);
    await loadPiece();
  }

  async function handleDownload(fileId: string) {
    const result = await repertoire.getPieceFileDownloadUrl(org.id, piece.id, fileId);
    if (!result.ok) {
      setError(repertoireErrorMessage(result.error));
      return;
    }
    window.open(result.value, '_blank', 'noopener,noreferrer');
  }

  async function handleRemoveFile() {
    if (!editingFile) {
      return;
    }

    setIsRemovingFile(true);
    const result = await repertoire.removePieceFile(org.id, piece.id, editingFile.id);
    setIsRemovingFile(false);

    if (!result.ok) {
      setError(repertoireErrorMessage(result.error));
      return;
    }

    setEditingFile(null);
    await loadPiece();
  }

  async function handleSoftDelete() {
    setIsDeleting(true);
    const result = await repertoire.softDeletePiece(org.id, piece.id);
    setIsDeleting(false);

    if (!result.ok) {
      setError(repertoireErrorMessage(result.error));
      return;
    }

    navigate(repertoirePath(orgSlug!, 'pieces'));
  }

  return (
    <>
    <div className={`mx-auto flex max-w-2xl flex-col ${orgListPageHeightClass}`}>
      <div className="shrink-0 space-y-4">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <BackButton fallbackTo={repertoirePath(orgSlug!, 'pieces')} />
          <h1 className="min-w-0 flex-1 text-xl font-semibold text-text sm:text-2xl ml-1">
            {piece.title}
          </h1>
          <CategoryBadge
            label={piece.category.name}
            color={piece.category.color}
            slug={piece.category.slug}
            className="shrink-0"
          />
        </div>

        {hasCollapsibleContent && (
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
              fichaExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-2">
                {piece.composer && (
                  <div>
                    <h2 className="text-sm font-medium text-text">Compositor</h2>
                    <p className="mt-1 text-muted">{piece.composer}</p>
                  </div>
                )}

                {piece.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {piece.themes.map((theme) => (
                      <span
                        key={theme.id}
                        className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                      >
                        {theme.name}
                      </span>
                    ))}
                  </div>
                )}

                {piece.aliases.length > 0 && (
                  <div>
                    <h2 className="text-sm font-medium text-text">Apelidos</h2>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {piece.aliases.map((alias) => (
                        <span
                          key={alias}
                          className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
                        >
                          {alias}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {piece.description && (
                  <div>
                    <h2 className="text-sm font-medium text-text">Descrição</h2>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                      {piece.description}
                    </p>
                  </div>
                )}

                {piece.notes && (
                  <div>
                    <h2 className="text-sm font-medium text-text">Notas</h2>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{piece.notes}</p>
                  </div>
                )}

                {isAdmin && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={openEditModal}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <IconPencil className="h-4 w-4" />
                      Editar peça
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {hasCollapsibleContent && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setFichaExpanded((prev) => !prev)}
              aria-expanded={fichaExpanded}
              className="text-sm font-medium text-primary hover:underline"
            >
              {fichaExpanded ? 'Ver menos' : 'Ver mais detalhes'}
            </button>
          </div>
        )}
      </section>

      <hr className="border-border" />

      {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <PieceFilesSection
        files={piece.files}
        parts={parts}
        isAdmin={isAdmin}
        userPartIds={userPartIds}
        onDownload={handleDownload}
        onEdit={setEditingFile}
        onAddFiles={handleAddFiles}
        isAddingFiles={isPreparingUpload}
      />
    </div>

      <Modal
        open={editOpen}
        onClose={() => !isSaving && !isDeleting && setEditOpen(false)}
        title="Editar peça"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text">Título</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text">Compositor</span>
            <input
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />
          </label>
          <PieceAliasesField value={aliases} onChange={setAliases} />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text">Categoria</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text">Descrição</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text">Notas</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />
          </label>
          {themes.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-text">Temas</legend>
              <div className="flex flex-wrap gap-2">
                {themes.map((theme) => {
                  const checked = selectedThemeIds.includes(theme.id);
                  return (
                    <label
                      key={theme.id}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                        checked ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleTheme(theme.id)}
                      />
                      {theme.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleSoftDelete}
              disabled={isSaving || isDeleting}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-60"
            >
              <IconTrash className="h-4 w-4" />
              {isDeleting ? 'Arquivando…' : 'Arquivar peça'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setError(null);
                }}
                disabled={isSaving || isDeleting}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={uploadOpen}
        onClose={() => !isUploading && setUploadOpen(false)}
        title={
          uploadEntries.length > 1
            ? `Adicionar ${uploadEntries.length} arquivos`
            : 'Adicionar arquivo'
        }
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <PieceFileUploadEntries
            entries={uploadEntries}
            parts={parts}
            disabled={isUploading}
            onEntryChange={updateUploadEntry}
            onRemoveEntry={removeUploadEntry}
          />
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setUploadOpen(false)}
              disabled={isUploading}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUploading || uploadEntries.length === 0}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isUploading && uploadProgress
                ? `Enviando ${uploadProgress.current} de ${uploadProgress.total}…`
                : uploadEntries.length > 1
                  ? `Enviar ${uploadEntries.length} arquivos`
                  : 'Enviar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editingFile !== null}
        onClose={() => !isRemovingFile && !isSavingFile && setEditingFile(null)}
        title="Editar arquivo"
      >
        {editingFile && (
          <div className="space-y-4">
            {isAdmin ? (
              <label className="block space-y-1">
                <span className="text-sm font-medium text-text">Título</span>
                <input
                  type="text"
                  value={editFileTitle}
                  onChange={(event) => setEditFileTitle(event.target.value)}
                  disabled={isSavingFile || isRemovingFile}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
                />
              </label>
            ) : (
              <p className="font-medium text-text">{editingFile.title}</p>
            )}
            <div className="space-y-1 text-sm text-muted">
              <p>{pieceFileKindLabel(editingFile.kind)}</p>
              {editingFile.kind === 'score' && !isAdmin && (
                <p>{formatPartLinks(editingFile.partLinks, parts)}</p>
              )}
              <p className="text-xs">{editingFile.originalName}</p>
            </div>
            {isAdmin && editingFile.kind === 'score' && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-text">
                  Partes (instrumentos ou vozes)
                </legend>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {parts.map((part) => (
                    <div key={part.id} className="space-y-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isPartLinkSelectedIn(editFilePartLinks, part.id, null)}
                          onChange={() => togglePartLinkIn(setEditFilePartLinks, part.id, null)}
                          disabled={isSavingFile || isRemovingFile}
                        />
                        {part.name}
                      </label>
                      {part.divisions.map((division) => (
                        <label
                          key={division.id}
                          className="ml-6 flex items-center gap-2 text-sm text-muted"
                        >
                          <input
                            type="checkbox"
                            checked={isPartLinkSelectedIn(
                              editFilePartLinks,
                              part.id,
                              division.id,
                            )}
                            onChange={() =>
                              togglePartLinkIn(setEditFilePartLinks, part.id, division.id)
                            }
                            disabled={isSavingFile || isRemovingFile}
                          />
                          {division.name}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => handleDownload(editingFile.id)}
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                <IconArrowDown className="h-4 w-4" />
                Baixar arquivo
              </button>
            </div>
            {editFileError && <p className="text-sm text-red-600">{editFileError}</p>}
            {isAdmin && (
              <div className="flex justify-between gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isRemovingFile || isSavingFile}
                  className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline disabled:opacity-60"
                >
                  <IconTrash className="h-4 w-4" />
                  {isRemovingFile ? 'Arquivando…' : 'Arquivar'}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingFile(null)}
                    disabled={isRemovingFile || isSavingFile}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFile}
                    disabled={
                      isRemovingFile ||
                      isSavingFile ||
                      (editFileTitle.trim() === editingFile.title &&
                        (editingFile.kind !== 'score' ||
                          partLinksEqual(editFilePartLinks, editingFile.partLinks)))
                    }
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {isSavingFile ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
