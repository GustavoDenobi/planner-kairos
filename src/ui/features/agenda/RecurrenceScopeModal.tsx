import type { RecurrenceEditScope } from '@/domain/agenda';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { Modal } from '@/ui/components/Modal';
import {
  RECURRENCE_SCOPE_CANCEL_LABELS,
  RECURRENCE_SCOPE_DELETE_LABELS,
  RECURRENCE_SCOPE_SAVE_LABELS,
  RECURRENCE_SCOPE_SAVE_SCHEDULE_LABELS,
} from '@/ui/features/agenda/agenda-labels';

type RecurrenceScopeModalProps = {
  open: boolean;
  mode: 'save' | 'delete' | 'cancel';
  onClose: () => void;
  onConfirm: (scope: RecurrenceEditScope) => void;
  isConfirming?: boolean;
  scheduleChanged?: boolean;
};

export function RecurrenceScopeModal({
  open,
  mode,
  onClose,
  onConfirm,
  isConfirming = false,
  scheduleChanged = false,
}: RecurrenceScopeModalProps) {
  const saveScheduleChanged = mode === 'save' && scheduleChanged;
  const scopes: RecurrenceEditScope[] = saveScheduleChanged
    ? ['this', 'following']
    : ['this', 'following', 'all_future'];

  function labelFor(scope: RecurrenceEditScope): { title: string; description: string } {
    if (saveScheduleChanged && scope !== 'all_future') {
      return RECURRENCE_SCOPE_SAVE_SCHEDULE_LABELS[scope];
    }
    if (mode === 'save') {
      return RECURRENCE_SCOPE_SAVE_LABELS[scope];
    }
    if (mode === 'cancel') {
      return RECURRENCE_SCOPE_CANCEL_LABELS[scope];
    }
    return RECURRENCE_SCOPE_DELETE_LABELS[scope];
  }

  const title =
    mode === 'save'
      ? 'Alterar evento recorrente'
      : mode === 'cancel'
        ? 'Cancelar evento recorrente'
        : 'Excluir evento recorrente';

  const description = saveScheduleChanged
    ? 'A data ou o horário mudou. Como deseja aplicar?'
    : mode === 'save'
      ? 'Este evento faz parte de uma série. O que deseja alterar?'
      : mode === 'cancel'
        ? 'Este evento faz parte de uma série. O que deseja cancelar?'
        : 'Este evento faz parte de uma série. O que deseja excluir?';

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <p className="text-sm text-muted">{description}</p>
        <div className="space-y-2">
          {scopes.map((scope) => {
            const label = labelFor(scope);
            return (
              <button
                key={scope}
                type="button"
                disabled={isConfirming}
                onClick={() => onConfirm(scope)}
                className="block w-full rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm text-text transition-colors hover:bg-bg disabled:opacity-60"
              >
                <span className="font-medium">{label.title}</span>
                <span className="mt-1 block text-muted">{label.description}</span>
              </button>
            );
          })}
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
