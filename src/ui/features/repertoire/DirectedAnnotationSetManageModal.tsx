import { useState } from 'react';
import type { AnnotationSet } from '@/domain/repertoire';
import { formatAnnotationSetLabel, resolveAnnotationSetAudience } from '@/domain/repertoire';
import type { AnnotationSetAudienceLookup } from '@/domain/repertoire';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { IconPencil, IconPlus, IconTrash } from '@/ui/components/icons';
import { Modal } from '@/ui/components/Modal';

export type DirectedAnnotationSetManageModalProps = {
  open: boolean;
  sets: AnnotationSet[];
  audienceLookup?: AnnotationSetAudienceLookup;
  highlightedSetId?: string | null;
  onClose: () => void;
  onCreate: () => void;
  onEdit: (set: AnnotationSet) => void;
  onDelete: (setId: string) => Promise<boolean>;
};

export function DirectedAnnotationSetManageModal({
  open,
  sets,
  audienceLookup,
  highlightedSetId = null,
  onClose,
  onCreate,
  onEdit,
  onDelete,
}: DirectedAnnotationSetManageModalProps) {
  const [pendingDeleteSet, setPendingDeleteSet] = useState<AnnotationSet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!pendingDeleteSet) {
      return;
    }

    setIsDeleting(true);
    const ok = await onDelete(pendingDeleteSet.id);
    setIsDeleting(false);

    if (ok) {
      setPendingDeleteSet(null);
    }
  }

  const resolvedSets = sets.map((set) => resolveAnnotationSetAudience(set, audienceLookup));

  return (
    <>
      <Modal open={open} onClose={onClose} title="Conjuntos para alunos" size="lg">
        <div className="space-y-4">
          {resolvedSets.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhum conjunto criado ainda. Crie um conjunto para anotar para turmas ou alunos
              específicos.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {resolvedSets.map((set) => {
                const label = formatAnnotationSetLabel(set);
                const isHighlighted = highlightedSetId === set.id;

                return (
                  <li
                    key={set.id}
                    className={`flex items-center gap-3 px-3 py-3 ${
                      isHighlighted ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{label}</p>
                      {isHighlighted && (
                        <p className="text-xs text-muted">Selecionado para edição</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(set)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text hover:bg-bg"
                        aria-label={`Editar ${label}`}
                        title="Editar"
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteSet(set)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-danger hover:bg-danger/10"
                        aria-label={`Excluir ${label}`}
                        title="Excluir"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-2 text-sm text-text"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-fg"
            >
              <IconPlus className="h-4 w-4" />
              Novo conjunto
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={pendingDeleteSet != null}
        title="Excluir conjunto"
        message={
          pendingDeleteSet ? (
            <>
              Excluir o conjunto{' '}
              <strong>{formatAnnotationSetLabel(resolveAnnotationSetAudience(pendingDeleteSet, audienceLookup))}</strong>
              ? As anotações desse conjunto também serão removidas.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Excluir"
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => {
          if (!isDeleting) {
            setPendingDeleteSet(null);
          }
        }}
        isConfirming={isDeleting}
      />
    </>
  );
}
