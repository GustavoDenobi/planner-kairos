import { useCallback, useEffect, useState } from 'react';

import type {
  CreatePieceFileTocEntryInput,
  PieceFileTocEntry,
  UpdatePieceFileTocEntryInput,
} from '@/domain/repertoire';

import { Modal } from '@/ui/components/Modal';
import { SortableDragHandle, SortableList } from '@/ui/components/SortableList';

export type TocPickResult = {
  pageNumber: number;
  y: number;
  x?: number;
};

type DraftTocEntry = {
  label: string;
  targetPageNumber: number;
  targetX: number | null;
  targetY: number | null;
  endPageNumber: string;
};

type PieceFileTocEditorProps = {
  open: boolean;
  entries: PieceFileTocEntry[];
  numPages: number;
  currentPage: number;
  pickActive: boolean;
  lastPick: TocPickResult | null;
  onPickConsumed: () => void;
  onClose: () => void;
  onRequestPick: (active: boolean) => void;
  onCreate: (input: Omit<CreatePieceFileTocEntryInput, 'pieceFileId'>) => Promise<void>;
  onUpdate: (id: string, input: UpdatePieceFileTocEntryInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
};

function emptyDraft(currentPage: number): DraftTocEntry {
  return {
    label: '',
    targetPageNumber: currentPage,
    targetX: null,
    targetY: null,
    endPageNumber: '',
  };
}

export function PieceFileTocEditor({
  open,
  entries,
  numPages,
  currentPage,
  pickActive,
  lastPick,
  onPickConsumed,
  onClose,
  onRequestPick,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}: PieceFileTocEditorProps) {
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftTocEntry>(() => emptyDraft(currentPage));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lastPick || !pickActive) {
      return;
    }
    setDraft((current) => ({
      ...current,
      targetPageNumber: lastPick.pageNumber,
      targetX: lastPick.x ?? 0.5,
      targetY: lastPick.y,
    }));
    onPickConsumed();
    onRequestPick(false);
  }, [lastPick, onPickConsumed, onRequestPick, pickActive]);

  useEffect(() => {
    if (!open) {
      setMode('list');
      setEditingId(null);
      setDraft(emptyDraft(currentPage));
      setError(null);
      onRequestPick(false);
    }
  }, [open, currentPage, onRequestPick]);

  const startAdd = () => {
    setDraft(emptyDraft(currentPage));
    setEditingId(null);
    setMode('add');
    setError(null);
  };

  const startEdit = (entry: PieceFileTocEntry) => {
    setDraft({
      label: entry.label,
      targetPageNumber: entry.targetPageNumber,
      targetX: entry.targetX,
      targetY: entry.targetY,
      endPageNumber: entry.endPageNumber != null ? String(entry.endPageNumber) : '',
    });
    setEditingId(entry.id);
    setMode('edit');
    setError(null);
  };

  const handleSave = async () => {
    if (!draft.label.trim()) {
      setError('Informe um título para a entrada.');
      return;
    }
    if (draft.targetPageNumber < 1 || draft.targetPageNumber > numPages) {
      setError(`A página inicial deve estar entre 1 e ${numPages}.`);
      return;
    }

    const endPage = draft.endPageNumber.trim()
      ? Number.parseInt(draft.endPageNumber, 10)
      : null;
    if (endPage != null && (endPage < 1 || endPage > numPages || endPage < draft.targetPageNumber)) {
      setError(`A página final deve estar entre ${draft.targetPageNumber} e ${numPages}.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === 'add') {
        await onCreate({
          label: draft.label.trim(),
          targetPageNumber: draft.targetPageNumber,
          targetX: draft.targetY != null ? draft.targetX : null,
          targetY: draft.targetY,
          endPageNumber: endPage,
        });
      } else if (mode === 'edit' && editingId) {
        await onUpdate(editingId, {
          label: draft.label.trim(),
          targetPageNumber: draft.targetPageNumber,
          targetX: draft.targetY != null ? draft.targetX : null,
          targetY: draft.targetY,
          endPageNumber: endPage,
        });
      }
      setMode('list');
      setEditingId(null);
      onRequestPick(false);
    } catch {
      setError('Não foi possível salvar a entrada.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await onDelete(id);
    } catch {
      setError('Não foi possível excluir a entrada.');
    } finally {
      setBusy(false);
    }
  };

  const handleReorder = useCallback(
    async (items: PieceFileTocEntry[]) => {
      await onReorder(items.map((item) => item.id));
    },
    [onReorder],
  );

  const formView = (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-text" htmlFor="toc-label">
          Título
        </label>
        <input
          id="toc-label"
          type="text"
          value={draft.label}
          onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
          placeholder="Ex.: Lição 4"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text" htmlFor="toc-target-page">
          Página inicial
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="toc-target-page"
            type="number"
            min={1}
            max={numPages}
            value={draft.targetPageNumber}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                targetPageNumber: Number.parseInt(event.target.value, 10) || 1,
                targetX: null,
                targetY: null,
              }))
            }
            className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          />
          <button
            type="button"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                targetPageNumber: currentPage,
                targetX: null,
                targetY: null,
              }))
            }
            className="rounded-lg border border-border px-3 py-2 text-sm text-text"
          >
            Usar página atual
          </button>
          <button
            type="button"
            onClick={() => onRequestPick(true)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              pickActive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text'
            }`}
          >
            {pickActive ? 'Toque na partitura…' : 'Toque para marcar posição'}
          </button>
        </div>
        {draft.targetY != null && (
          <p className="mt-1 text-xs text-muted">
            Posição marcada na página {draft.targetPageNumber}.
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, targetX: null, targetY: null }))}
              className="ml-2 text-primary hover:underline"
            >
              Remover posição
            </button>
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text" htmlFor="toc-end-page">
          Página final (opcional)
        </label>
        <input
          id="toc-end-page"
          type="number"
          min={1}
          max={numPages}
          value={draft.endPageNumber}
          onChange={(event) =>
            setDraft((current) => ({ ...current, endPageNumber: event.target.value }))
          }
          placeholder="Mesma que a inicial"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('list');
            setEditingId(null);
            onRequestPick(false);
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text"
        >
          Voltar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Salvar
        </button>
      </div>
    </div>
  );

  const listView = (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma entrada no sumário. Adicione entradas para indexar este PDF.
        </p>
      ) : (
        <SortableList
          items={entries}
          onReorder={(items) => void handleReorder(items)}
          ariaLabel="Reordenar lições do sumário"
          className="space-y-2"
          renderItem={(entry, handle) => (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
              <SortableDragHandle {...handle} label={`Reordenar ${entry.label}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text">{entry.label}</p>
                <p className="text-xs text-muted">
                  p. {entry.targetPageNumber}
                  {entry.endPageNumber != null && entry.endPageNumber !== entry.targetPageNumber
                    ? `–${entry.endPageNumber}`
                    : ''}
                  {entry.targetY != null ? ' · posição marcada' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(entry)}
                className="rounded-lg border border-border px-2 py-1 text-xs text-text"
              >
                Editar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete(entry.id)}
                className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700"
              >
                Excluir
              </button>
            </div>
          )}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={startAdd}
        className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text"
      >
        Adicionar
      </button>
    </div>
  );

  return (
    <Modal
      open={open && !pickActive}
      onClose={onClose}
      title={mode === 'list' ? 'Editar sumário' : mode === 'add' ? 'Nova entrada' : 'Editar entrada'}
    >
      {mode === 'list' ? listView : formView}
    </Modal>
  );
}

type PieceFileTocPanelProps = {
  open: boolean;
  entries: PieceFileTocEntry[];
  canManage: boolean;
  onClose: () => void;
  onEntryPress: (entry: PieceFileTocEntry) => void;
  onEdit: () => void;
};

export function PieceFileTocPanel({
  open,
  entries,
  canManage,
  onClose,
  onEntryPress,
  onEdit,
}: PieceFileTocPanelProps) {
  return (
    <Modal open={open} onClose={onClose} title="Sumário">
      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted">Este PDF ainda não tem sumário configurado.</p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    onEntryPress(entry);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-surface-muted"
                >
                  <span className="font-medium text-text">{entry.label}</span>
                  <span className="text-muted">
                    p. {entry.targetPageNumber}
                    {entry.endPageNumber != null && entry.endPageNumber !== entry.targetPageNumber
                      ? `–${entry.endPageNumber}`
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text"
          >
            {entries.length === 0 ? 'Configurar sumário' : 'Editar sumário'}
          </button>
        )}
      </div>
    </Modal>
  );
}
