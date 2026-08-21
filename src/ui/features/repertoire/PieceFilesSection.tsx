import { useId, useMemo, useRef, useState } from 'react';
import { partitionPieceFilesForViewer } from '@/domain/repertoire';
import type { PieceFileKind, PieceFileWithLinks } from '@/domain/repertoire';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { IconFilter, IconPencil, IconPlus } from '@/ui/components/icons';
import { OfflineDownloadButton } from '@/ui/features/pwa/OfflineDownloadButton';
import { formatPartLinks, pieceFileKindLabel } from '@/ui/features/repertoire/repertoire-labels';

type PartFilterOption = {
  partId: string;
  label: string;
};

type DivisionFilterOption = {
  partDivisionId: string;
  label: string;
  partId: string;
};

type PieceFilesSectionProps = {
  files: PieceFileWithLinks[];
  parts: PartWithDivisions[];
  isAdmin: boolean;
  userPartIds: string[];
  isConductor?: boolean;
  allowDownload?: boolean;
  onOpen: (file: PieceFileWithLinks) => void;
  onEdit: (file: PieceFileWithLinks) => void;
  onAddFiles: (files: File[]) => void;
  isAddingFiles?: boolean;
};

const FILE_ACCEPT = 'application/pdf,audio/mpeg,audio/wav';

const filterInputClass =
  'min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text';

const filterSelectClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text';

function fileMatchesPartFilter(
  file: PieceFileWithLinks,
  partId: string,
  divisionId: string,
): boolean {
  if (file.kind === 'audio') {
    return partId === '' && divisionId === '';
  }

  if (file.partLinks.length === 0) {
    return partId === 'general';
  }

  return file.partLinks.some((link) => {
    if (partId && link.partId !== partId) {
      return false;
    }
    if (divisionId && link.partDivisionId !== divisionId) {
      return false;
    }
    return true;
  });
}

function fileMatchesKindFilter(file: PieceFileWithLinks, kind: string): boolean {
  if (!kind) {
    return true;
  }
  return file.kind === kind;
}

function fileMatchesTitleFilter(file: PieceFileWithLinks, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }
  return file.title.toLowerCase().includes(normalizedQuery);
}

function FileList({
  files,
  parts,
  isAdmin,
  allowDownload,
  onOpen,
  onEdit,
}: {
  files: PieceFileWithLinks[];
  parts: PartWithDivisions[];
  isAdmin: boolean;
  allowDownload: boolean;
  onOpen: (file: PieceFileWithLinks) => void;
  onEdit: (file: PieceFileWithLinks) => void;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li key={file.id}>
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
            <button
              type="button"
              onClick={() => onOpen(file)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="font-medium text-text">{file.title}</p>
              <p className="mt-0.5 text-sm text-muted">
                {file.kind === 'score'
                  ? formatPartLinks(file.partLinks, parts)
                  : pieceFileKindLabel(file.kind)}
              </p>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              {allowDownload && (
                <OfflineDownloadButton
                  organizationId={file.organizationId}
                  pieceId={file.pieceId}
                  fileId={file.id}
                  compact
                />
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onEdit(file)}
                  aria-label={`Editar ${file.title}`}
                  className="rounded-lg border border-border p-2 text-muted hover:text-text"
                >
                  <IconPencil className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PieceFilesSection({
  files,
  parts,
  isAdmin,
  userPartIds,
  isConductor = false,
  allowDownload = true,
  onOpen,
  onEdit,
  onAddFiles,
  isAddingFiles = false,
}: PieceFilesSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filtersPanelId = useId();
  const [titleFilter, setTitleFilter] = useState('');
  const [partFilter, setPartFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const partById = useMemo(() => new Map(parts.map((part) => [part.id, part])), [parts]);

  const partOptions = useMemo(() => {
    const options: PartFilterOption[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      if (file.kind !== 'score') {
        continue;
      }
      if (file.partLinks.length === 0) {
        if (!seen.has('general')) {
          seen.add('general');
          options.push({ partId: 'general', label: 'Geral' });
        }
        continue;
      }
      for (const link of file.partLinks) {
        if (seen.has(link.partId)) {
          continue;
        }
        const part = partById.get(link.partId);
        if (!part) {
          continue;
        }
        seen.add(link.partId);
        options.push({ partId: link.partId, label: part.name });
      }
    }

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [files, partById]);

  const divisionOptions = useMemo(() => {
    const options: DivisionFilterOption[] = [];
    const seen = new Set<string>();

    for (const file of files) {
      if (file.kind !== 'score') {
        continue;
      }
      for (const link of file.partLinks) {
        if (!link.partDivisionId || seen.has(link.partDivisionId)) {
          continue;
        }
        const part = partById.get(link.partId);
        const division = part?.divisions.find((item) => item.id === link.partDivisionId);
        if (!division) {
          continue;
        }
        seen.add(link.partDivisionId);
        options.push({
          partDivisionId: link.partDivisionId,
          label: `${part!.name} - ${division.name}`,
          partId: link.partId,
        });
      }
    }

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [files, partById]);

  const visibleDivisionOptions = useMemo(() => {
    if (!partFilter || partFilter === 'general') {
      return divisionOptions;
    }
    return divisionOptions.filter((option) => option.partId === partFilter);
  }, [divisionOptions, partFilter]);

  const kindOptions = useMemo(() => {
    const kinds = new Set<PieceFileKind>();
    for (const file of files) {
      kinds.add(file.kind);
    }
    return Array.from(kinds);
  }, [files]);

  const filteredFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          fileMatchesTitleFilter(file, titleFilter) &&
          fileMatchesKindFilter(file, kindFilter) &&
          fileMatchesPartFilter(file, partFilter, divisionFilter),
      ),
    [files, titleFilter, kindFilter, partFilter, divisionFilter],
  );

  const { userFiles, generalFiles, audioFiles, otherFiles } = partitionPieceFilesForViewer(
    filteredFiles,
    userPartIds,
    isConductor,
  );
  const showOtherHeading =
    userFiles.length > 0 || generalFiles.length > 0 || audioFiles.length > 0;

  const hasFilters = partOptions.length > 0 || divisionOptions.length > 0 || kindOptions.length > 1;
  const extraFiltersActive = Boolean(partFilter || divisionFilter || kindFilter);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3 mt-3">
          <h2 className="text-lg font-medium text-text">Arquivos</h2>
          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={FILE_ACCEPT}
                multiple
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  if (selected.length > 0) {
                    onAddFiles(selected);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAddingFiles}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <IconPlus className="h-4 w-4" />
                {isAddingFiles ? 'Verificando…' : 'Arquivo'}
              </button>
            </>
          )}
        </div>

        {files.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-stretch gap-2">
              <input
                type="search"
                value={titleFilter}
                onChange={(event) => setTitleFilter(event.target.value)}
                placeholder="Título do arquivo"
                aria-label="Buscar por título do arquivo"
                className={filterInputClass}
              />
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => setFiltersOpen((current) => !current)}
                  className={`relative inline-flex shrink-0 items-center justify-center rounded-lg border p-2 transition-colors ${
                    filtersOpen
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface text-muted hover:bg-bg hover:text-text'
                  }`}
                  aria-label={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
                  aria-expanded={filtersOpen}
                  aria-controls={filtersPanelId}
                >
                  <IconFilter className="h-4 w-4" />
                  {extraFiltersActive && !filtersOpen && (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </button>
              )}
            </div>

            {hasFilters && filtersOpen && (
              <div id={filtersPanelId} className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {partOptions.length > 0 && (
                  <label className="min-w-0">
                    <span className="sr-only">Parte</span>
                    <select
                      aria-label="Parte"
                      value={partFilter}
                      onChange={(event) => {
                        setPartFilter(event.target.value);
                        setDivisionFilter('');
                      }}
                      className={filterSelectClass}
                    >
                      <option value="">Partes (tudo)</option>
                      {partOptions.map((option) => (
                        <option key={option.partId} value={option.partId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {visibleDivisionOptions.length > 0 && (
                  <label className="min-w-0">
                    <span className="sr-only">Divisão</span>
                    <select
                      aria-label="Divisão"
                      value={divisionFilter}
                      onChange={(event) => setDivisionFilter(event.target.value)}
                      className={filterSelectClass}
                    >
                      <option value="">Divisões (tudo)</option>
                      {visibleDivisionOptions.map((option) => (
                        <option key={option.partDivisionId} value={option.partDivisionId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {kindOptions.length > 1 && (
                  <label className="min-w-0">
                    <span className="sr-only">Tipo de arquivo</span>
                    <select
                      aria-label="Tipo de arquivo"
                      value={kindFilter}
                      onChange={(event) => setKindFilter(event.target.value)}
                      className={filterSelectClass}
                    >
                      <option value="">Tipos (tudo)</option>
                      {kindOptions.map((kind) => (
                        <option key={kind} value={kind}>
                          {pieceFileKindLabel(kind)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border pt-3">
        {filteredFiles.length === 0 ? (
          <p className="text-sm text-muted">Nenhum arquivo.</p>
        ) : (
          <div className="space-y-4">
            {userFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-text">Suas partes</h3>
                <FileList
                  files={userFiles}
                  parts={parts}
                  isAdmin={isAdmin}
                  allowDownload={allowDownload}
                  onOpen={onOpen}
                  onEdit={onEdit}
                />
              </div>
            )}

            {generalFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-text">Geral</h3>
                <FileList
                  files={generalFiles}
                  parts={parts}
                  isAdmin={isAdmin}
                  allowDownload={allowDownload}
                  onOpen={onOpen}
                  onEdit={onEdit}
                />
              </div>
            )}

            {audioFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-text">Áudios</h3>
                <FileList
                  files={audioFiles}
                  parts={parts}
                  isAdmin={isAdmin}
                  allowDownload={allowDownload}
                  onOpen={onOpen}
                  onEdit={onEdit}
                />
              </div>
            )}

            {otherFiles.length > 0 && (
              <div className="space-y-2">
                {showOtherHeading && (
                  <h3 className="text-sm font-medium text-text">Outros arquivos</h3>
                )}
                <FileList
                  files={otherFiles}
                  parts={parts}
                  isAdmin={isAdmin}
                  allowDownload={allowDownload}
                  onOpen={onOpen}
                  onEdit={onEdit}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
