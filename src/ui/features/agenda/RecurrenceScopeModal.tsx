import type { RecurrenceEditScope } from '@/domain/agenda';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { Modal } from '@/ui/components/Modal';
import {
  RECURRENCE_SCOPE_DELETE_LABELS,
  RECURRENCE_SCOPE_SAVE_LABELS,
} from '@/ui/features/agenda/agenda-labels';

type RecurrenceScopeModalProps = {
  open: boolean;
  mode: 'save' | 'delete';
  onClose: () => void;
  onConfirm: (scope: RecurrenceEditScope) => void;
  isConfirming?: boolean;
};

export function RecurrenceScopeModal({
  open,
  mode,
  onClose,
  onConfirm,
  isConfirming = false,
}: RecurrenceScopeModalProps) {
  const labels = mode === 'save' ? RECURRENCE_SCOPE_SAVE_LABELS : RECURRENCE_SCOPE_DELETE_LABELS;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'save' ? 'Alterar evento recorrente' : 'Excluir evento recorrente'}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">
          {mode === 'save'
            ? 'Este evento faz parte de uma série. O que deseja alterar?'
            : 'Este evento faz parte de uma série. O que deseja excluir?'}
        </p>
        <div className="space-y-2">
          {(['this', 'following', 'all_future'] as RecurrenceEditScope[]).map((scope) => (
            <button
              key={scope}
              type="button"
              disabled={isConfirming}
              onClick={() => onConfirm(scope)}
              className="block w-full rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm text-text transition-colors hover:bg-bg disabled:opacity-60"
            >
              <span className="font-medium">{labels[scope].title}</span>
              <span className="mt-1 block text-muted">{labels[scope].description}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

type CancelRecurrenceConfirmProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isConfirming?: boolean;
};

export function CancelRecurrenceConfirmModal({
  open,
  onClose,
  onConfirm,
  isConfirming = false,
}: CancelRecurrenceConfirmProps) {
  return (
    <ConfirmModal
      open={open}
      title="Cancelar série"
      message="Os eventos futuros desta série serão removidos. Eventos passados permanecem no histórico."
      confirmLabel="Cancelar série"
      onConfirm={onConfirm}
      onClose={onClose}
      isConfirming={isConfirming}
    />
  );
}
