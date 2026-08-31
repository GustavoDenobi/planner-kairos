import { useEffect, useMemo, useState } from 'react';
import type {
  PieceFileOrganization,
  PieceFileWithLinks,
  PdfNavigationShortcut,
  PieceFileTocEntry,
} from '@/domain/repertoire';
import type { ProgramItemUnitInput } from '@/domain/agenda';
import { Modal } from '@/ui/components/Modal';

export type ProgramUnitsEditorValue = ProgramItemUnitInput[];

type EventProgramUnitsEditorProps = {
  open: boolean;
  pieceTitle: string;
  fileOrganization: PieceFileOrganization;
  scoreFiles: PieceFileWithLinks[];
  shortcutsByFileId: Map<string, PdfNavigationShortcut[]>;
  tocEntriesByFileId: Map<string, PieceFileTocEntry[]>;
  initialUnits: ProgramUnitsEditorValue;
  onClose: () => void;
  onConfirm: (units: ProgramUnitsEditorValue) => void;
};

type UnitDraft = {
  pieceFileId: string;
  selected: boolean;
  scope: 'full' | 'toc' | 'pages' | 'shortcut';
  pieceFileTocEntryId: string;
  startPage: string;
  endPage: string;
  navigationShortcutId: string;
  label: string;
};

function buildDrafts(
  scoreFiles: PieceFileWithLinks[],
  initialUnits: ProgramUnitsEditorValue,
): UnitDraft[] {
  if (initialUnits.length > 0) {
    return initialUnits.map((unit) => ({
      pieceFileId: unit.pieceFileId,
      selected: true,
      scope: unit.pieceFileTocEntryId
        ? 'toc'
        : unit.navigationShortcutId
          ? 'shortcut'
          : unit.startPage != null || unit.endPage != null
            ? 'pages'
            : 'full',
      pieceFileTocEntryId: unit.pieceFileTocEntryId ?? '',
      startPage: unit.startPage != null ? String(unit.startPage) : '',
      endPage: unit.endPage != null ? String(unit.endPage) : '',
      navigationShortcutId: unit.navigationShortcutId ?? '',
      label: unit.label ?? '',
    }));
  }

  return scoreFiles.map((file) => ({
    pieceFileId: file.id,
    selected: scoreFiles.length === 1,
    scope: 'full' as const,
    pieceFileTocEntryId: '',
    startPage: '',
    endPage: '',
    navigationShortcutId: '',
    label: '',
  }));
}

function draftsToUnits(drafts: UnitDraft[]): ProgramUnitsEditorValue {
  return drafts
    .filter((draft) => draft.selected)
    .map((draft, index) => {
      const unit: ProgramItemUnitInput = {
        pieceFileId: draft.pieceFileId,
        sortOrder: index,
        label: draft.label.trim() || null,
        pieceFileTocEntryId: null,
        navigationShortcutId: null,
        startPage: null,
        endPage: null,
      };

      if (draft.scope === 'toc' && draft.pieceFileTocEntryId) {
        unit.pieceFileTocEntryId = draft.pieceFileTocEntryId;
      } else if (draft.scope === 'shortcut' && draft.navigationShortcutId) {
        unit.navigationShortcutId = draft.navigationShortcutId;
      } else if (draft.scope === 'pages') {
        unit.startPage = draft.startPage.trim() ? Number(draft.startPage) : null;
        unit.endPage = draft.endPage.trim() ? Number(draft.endPage) : null;
      }

      return unit;
    });
}

function ScopeFields({
  draft,
  shortcuts,
  tocEntries,
  onChange,
}: {
  draft: UnitDraft;
  shortcuts: PdfNavigationShortcut[];
  tocEntries: PieceFileTocEntry[];
  onChange: (patch: Partial<UnitDraft>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Escopo</span>
        <select
          value={draft.scope}
          onChange={(event) =>
            onChange({
              scope: event.target.value as UnitDraft['scope'],
              pieceFileTocEntryId: '',
              navigationShortcutId: '',
              startPage: '',
              endPage: '',
            })
          }
          className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
        >
          <option value="full">Completo</option>
          {tocEntries.length > 0 && <option value="toc">Selecionar do sumário</option>}
          <option value="pages">Selecionar páginas</option>
        </select>
      </label>

      {draft.scope === 'toc' && (
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Lição</span>
          <select
            value={draft.pieceFileTocEntryId}
            onChange={(event) =>
              onChange({
                pieceFileTocEntryId: event.target.value,
                label: tocEntries.find((entry) => entry.id === event.target.value)?.label ?? draft.label,
              })
            }
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Selecione…</option>
            {tocEntries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label} (p. {entry.targetPageNumber}
                {entry.endPageNumber != null && entry.endPageNumber !== entry.targetPageNumber
                  ? `–${entry.endPageNumber}`
                  : ''}
                )
              </option>
            ))}
          </select>
        </label>
      )}

      {draft.scope === 'pages' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">De</span>
            <input
              type="number"
              min={1}
              value={draft.startPage}
              onChange={(event) => onChange({ startPage: event.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Até</span>
            <input
              type="number"
              min={1}
              value={draft.endPage}
              onChange={(event) => onChange({ endPage: event.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      )}

      {draft.scope === 'shortcut' && (
        <label className="block space-y-1 text-sm">
          <span className="text-muted">Atalho</span>
          <select
            value={draft.navigationShortcutId}
            onChange={(event) => onChange({ navigationShortcutId: event.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">Selecione…</option>
            {shortcuts.map((shortcut) => (
              <option key={shortcut.id} value={shortcut.id}>
                {shortcut.label} (p. {shortcut.targetPageNumber})
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function EventProgramUnitsEditor({
  open,
  pieceTitle,
  fileOrganization,
  scoreFiles,
  shortcutsByFileId,
  tocEntriesByFileId,
  initialUnits,
  onClose,
  onConfirm,
}: EventProgramUnitsEditorProps) {
  const [drafts, setDrafts] = useState<UnitDraft[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDrafts(buildDrafts(scoreFiles, initialUnits));
  }, [open, scoreFiles, initialUnits]);

  const generalScoreFile = useMemo(
    () => scoreFiles.find((file) => file.partLinks.length === 0) ?? scoreFiles[0] ?? null,
    [scoreFiles],
  );

  function updateDraft(pieceFileId: string, patch: Partial<UnitDraft>, tocEntryId?: string) {
    setDrafts((current) =>
      current.map((draft) => {
        if (tocEntryId) {
          if (draft.pieceFileTocEntryId === tocEntryId) {
            return { ...draft, ...patch };
          }
          return draft;
        }
        if (draft.pieceFileId === pieceFileId && !draft.pieceFileTocEntryId) {
          return { ...draft, ...patch };
        }
        return draft;
      }),
    );
  }

  function toggleTocEntry(fileId: string, entry: PieceFileTocEntry, selected: boolean) {
    setDrafts((current) => {
      const withoutEntry = current.filter((draft) => draft.pieceFileTocEntryId !== entry.id);
      if (!selected) {
        return withoutEntry;
      }
      return [
        ...withoutEntry,
        {
          pieceFileId: fileId,
          selected: true,
          scope: 'toc' as const,
          pieceFileTocEntryId: entry.id,
          startPage: '',
          endPage: '',
          navigationShortcutId: '',
          label: entry.label,
        },
      ];
    });
  }

  function isTocEntrySelected(entryId: string) {
    return drafts.some((draft) => draft.selected && draft.pieceFileTocEntryId === entryId);
  }

  function handleConfirm() {
    onConfirm(draftsToUnits(drafts));
    onClose();
  }

  const title =
    fileOrganization === 'sequential'
      ? `Lições — ${pieceTitle}`
      : fileOrganization === 'distributed'
        ? `Trecho da partitura — ${pieceTitle}`
        : `Trecho — ${pieceTitle}`;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {fileOrganization === 'sequential' ? (
          <ul className="max-h-80 space-y-3 overflow-y-auto">
            {scoreFiles.map((file) => {
              const tocEntries = tocEntriesByFileId.get(file.id) ?? [];
              const shortcuts = shortcutsByFileId.get(file.id) ?? [];

              if (tocEntries.length > 0) {
                return (
                  <li key={file.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium text-text">{file.title}</p>
                    <ul className="mt-3 space-y-2 pl-2">
                      {tocEntries.map((entry) => (
                        <li key={entry.id}>
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={isTocEntrySelected(entry.id)}
                              onChange={(event) =>
                                toggleTocEntry(file.id, entry, event.target.checked)
                              }
                              className="mt-0.5"
                            />
                            <span>
                              {entry.label}
                              <span className="text-muted">
                                {' '}
                                (p. {entry.targetPageNumber}
                                {entry.endPageNumber != null
                                  && entry.endPageNumber !== entry.targetPageNumber
                                  ? `–${entry.endPageNumber}`
                                  : ''}
                                )
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              }

              const draft =
                drafts.find((item) => item.pieceFileId === file.id && !item.pieceFileTocEntryId) ??
                ({
                  pieceFileId: file.id,
                  selected: false,
                  scope: 'full',
                  pieceFileTocEntryId: '',
                  startPage: '',
                  endPage: '',
                  navigationShortcutId: '',
                  label: '',
                } satisfies UnitDraft);

              return (
                <li key={file.id} className="rounded-lg border border-border p-3">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(event) =>
                        updateDraft(file.id, { selected: event.target.checked })
                      }
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1 font-medium text-text">{file.title}</span>
                  </label>

                  {draft.selected && (
                    <div className="mt-3 pl-6">
                      <ScopeFields
                        draft={draft}
                        shortcuts={shortcuts}
                        tocEntries={tocEntries}
                        onChange={(patch) => updateDraft(file.id, patch)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          generalScoreFile && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-sm text-muted">
                Partitura: <span className="font-medium text-text">{generalScoreFile.title}</span>
              </p>
              {(() => {
                const draft = drafts[0] ?? {
                  pieceFileId: generalScoreFile.id,
                  selected: false,
                  scope: 'full' as const,
                  pieceFileTocEntryId: '',
                  startPage: '',
                  endPage: '',
                  navigationShortcutId: '',
                  label: '',
                };
                const shortcuts = shortcutsByFileId.get(generalScoreFile.id) ?? [];
                const tocEntries = tocEntriesByFileId.get(generalScoreFile.id) ?? [];

                return (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        onChange={(event) =>
                          setDrafts([
                            {
                              ...draft,
                              pieceFileId: generalScoreFile.id,
                              selected: event.target.checked,
                            },
                          ])
                        }
                      />
                      Limitar a um trecho específico
                    </label>

                    {draft.selected && (
                      <ScopeFields
                        draft={draft}
                        shortcuts={shortcuts}
                        tocEntries={tocEntries}
                        onChange={(patch) => setDrafts([{ ...draft, ...patch }])}
                      />
                    )}
                  </>
                );
              })()}
            </div>
          )
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
}
