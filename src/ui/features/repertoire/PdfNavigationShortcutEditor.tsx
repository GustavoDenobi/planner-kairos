import { useCallback, useEffect, useState } from 'react';

import type {
  CreatePdfNavigationShortcutInput,
  PdfNavigationShortcut,
  UpdatePdfNavigationShortcutInput,
} from '@/domain/repertoire';
import { resolveNavigationShortcutColor } from '@/domain/repertoire';

import { Modal } from '@/ui/components/Modal';
import { SortableList } from '@/ui/components/SortableList';
import { IconGripVertical } from '@/ui/components/icons';

export type ShortcutPickRequest =
  | { kind: 'target' }
  | { kind: 'anchor' }
  | null;

export type ShortcutPickResult = {
  pageNumber: number;
  y: number;
  x?: number;
};

type DraftShortcut = {
  label: string;
  targetPageNumber: number;
  targetX: number | null;
  targetY: number | null;
  anchorPageNumber: number | null;
  anchorX: number | null;
  anchorY: number | null;
};

type PdfNavigationShortcutEditorProps = {
  open: boolean;
  shortcuts: PdfNavigationShortcut[];
  numPages: number;
  currentPage: number;
  pickRequest: ShortcutPickRequest;
  lastPick: ShortcutPickResult | null;
  onPickConsumed: () => void;
  onClose: () => void;
  onRequestPick: (request: ShortcutPickRequest) => void;
  onCreate: (input: Omit<CreatePdfNavigationShortcutInput, 'pieceFileId'>) => Promise<void>;
  onUpdate: (id: string, input: UpdatePdfNavigationShortcutInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (orderedIds: string[]) => Promise<void>;
};

function emptyDraft(currentPage: number): DraftShortcut {
  return {
    label: '',
    targetPageNumber: currentPage,
    targetX: null,
    targetY: null,
    anchorPageNumber: null,
    anchorX: null,
    anchorY: null,
  };
}

export function PdfNavigationShortcutEditor({
  open,
  shortcuts,
  numPages,
  currentPage,
  pickRequest,
  lastPick,
  onPickConsumed,
  onClose,
  onRequestPick,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
}: PdfNavigationShortcutEditorProps) {
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftShortcut>(() => emptyDraft(currentPage));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lastPick || !pickRequest) {
      return;
    }

    setDraft((current) =>
      applyShortcutPick(current, lastPick, pickRequest.kind),
    );
    onPickConsumed();
    onRequestPick(null);
  }, [lastPick, onPickConsumed, onRequestPick, pickRequest]);

  useEffect(() => {
    if (!open) {
      setMode('list');
      setEditingId(null);
      setDraft(emptyDraft(currentPage));
      setError(null);
      onRequestPick(null);
    }
  }, [open, currentPage, onRequestPick]);

  const startAdd = () => {
    setDraft(emptyDraft(currentPage));
    setEditingId(null);
    setMode('add');
    setError(null);
  };

  const startEdit = (shortcut: PdfNavigationShortcut) => {
    setDraft({
      label: shortcut.label,
      targetPageNumber: shortcut.targetPageNumber,
      targetX: shortcut.targetX,
      targetY: shortcut.targetY,
      anchorPageNumber: shortcut.anchorPageNumber,
      anchorX: shortcut.anchorX,
      anchorY: shortcut.anchorY,
    });
    setEditingId(shortcut.id);
    setMode('edit');
    setError(null);
  };

  const handleSave = async () => {
    if (!draft.label.trim()) {
      setError('Informe um nome para o atalho.');
      return;
    }
    if (draft.targetPageNumber < 1 || draft.targetPageNumber > numPages) {
      setError(`A página de destino deve estar entre 1 e ${numPages}.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === 'add') {
        await onCreate({
          label: draft.label.trim(),
          targetPageNumber: draft.targetPageNumber,
          targetX: draft.targetX,
          targetY: draft.targetY,
          anchorPageNumber: draft.anchorPageNumber,
          anchorX: draft.anchorX,
          anchorY: draft.anchorY,
        });
      } else if (mode === 'edit' && editingId) {
        await onUpdate(editingId, {
          label: draft.label.trim(),
          targetPageNumber: draft.targetPageNumber,
          targetX: draft.targetX,
          targetY: draft.targetY,
          anchorPageNumber: draft.anchorPageNumber,
          anchorX: draft.anchorX,
          anchorY: draft.anchorY,
        });
      }
      setMode('list');
      setEditingId(null);
      onRequestPick(null);
    } catch {
      setError('Não foi possível salvar o atalho.');
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
      setError('Não foi possível excluir o atalho.');
    } finally {
      setBusy(false);
    }
  };

  const handleReorder = useCallback(
    async (items: PdfNavigationShortcut[]) => {
      await onReorder(items.map((item) => item.id));
    },
    [onReorder],
  );

  const clearAnchor = () => {
    setDraft((current) => ({
      ...current,
      anchorPageNumber: null,
      anchorX: null,
      anchorY: null,
    }));
  };

  const formView = (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-text" htmlFor="shortcut-label">
          Nome do atalho
        </label>
        <input
          id="shortcut-label"
          type="text"
          value={draft.label}
          onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
          placeholder="Ex.: Segno, Coda, Fine"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text" htmlFor="shortcut-target-page">
          Página de destino
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="shortcut-target-page"
            type="number"
            min={1}
            max={numPages}
            value={draft.targetPageNumber}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                targetPageNumber: Number.parseInt(event.target.value, 10) || 1,
              }))
            }
            className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          />
          <button
            type="button"
            onClick={() => onRequestPick({ kind: 'target' })}
            className={`rounded-lg border px-3 py-2 text-sm ${
              pickRequest?.kind === 'target'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text'
            }`}
          >
            {pickRequest?.kind === 'target' ? 'Toque na partitura…' : 'Toque para definir'}
          </button>
        </div>
        {draft.targetY != null && (
          <p className="mt-1 text-xs text-muted">
            Ponto de retorno marcado na página {draft.targetPageNumber}.
          </p>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-text">Botão na partitura (opcional)</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onRequestPick({ kind: 'anchor' })}
            className={`rounded-lg border px-3 py-2 text-sm ${
              pickRequest?.kind === 'anchor'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text'
            }`}
          >
            {pickRequest?.kind === 'anchor' ? 'Toque na partitura…' : 'Posicionar botão'}
          </button>
          {draft.anchorPageNumber != null && (
            <button
              type="button"
              onClick={clearAnchor}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text"
            >
              Remover posição
            </button>
          )}
        </div>
        {draft.anchorPageNumber != null && (
          <p className="mt-1 text-xs text-muted">
            Botão na página {draft.anchorPageNumber}.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('list');
            setEditingId(null);
            onRequestPick(null);
            setError(null);
          }}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy}
          className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open && pickRequest == null}
      onClose={onClose}
      title={mode === 'list' ? 'Atalhos de navegação' : mode === 'add' ? 'Novo atalho' : 'Editar atalho'}
    >
      {mode === 'list' ? (
        <div className="space-y-4">
          {shortcuts.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhum atalho configurado. Adicione botões para saltar rapidamente entre voltas e seções da partitura.
            </p>
          ) : (
            <SortableList
              items={shortcuts}
              onReorder={(items) => void handleReorder(items)}
              ariaLabel="Reordenar atalhos"
              renderItem={(item, handle) => (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2">
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-muted hover:text-text"
                    aria-label={`Reordenar ${item.label}`}
                    ref={handle.setActivatorNodeRef}
                    {...handle.attributes}
                    {...handle.listeners}
                  >
                    <IconGripVertical className="h-4 w-4" />
                  </button>
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border-2 bg-transparent"
                    style={{
                      borderColor: resolveNavigationShortcutColor(item.color, item.sortOrder),
                    }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{
                        color: resolveNavigationShortcutColor(item.color, item.sortOrder),
                      }}
                    >
                      {item.label}
                    </p>
                    <p className="text-xs text-muted">Página {item.targetPageNumber}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-text"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    disabled={busy}
                    className="rounded-lg border border-red-600 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
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
            className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text hover:border-primary"
          >
            Adicionar atalho
          </button>
        </div>
      ) : (
        formView
      )}
    </Modal>
  );
}

export function applyShortcutPick(
  draft: DraftShortcut,
  pick: ShortcutPickResult,
  kind: 'target' | 'anchor',
): DraftShortcut {
  if (kind === 'target') {
    return {
      ...draft,
      targetPageNumber: pick.pageNumber,
      targetX: pick.x ?? 0.5,
      targetY: pick.y,
    };
  }

  return {
    ...draft,
    anchorPageNumber: pick.pageNumber,
    anchorX: pick.x ?? 0.5,
    anchorY: pick.y,
  };
}

export type { DraftShortcut };
