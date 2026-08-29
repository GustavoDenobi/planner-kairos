import { useEffect, useState } from 'react';
import type { EventRecurrence, RecurrenceRule } from '@/domain/agenda';
import { Modal } from '@/ui/components/Modal';
import { toDatetimeLocalValue } from '@/ui/features/agenda/agenda-date';
import { RecurrenceFormFields } from '@/ui/features/agenda/RecurrenceFormFields';

type EditRecurrenceSeriesModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  recurrence: EventRecurrence | null;
  isLoading: boolean;
  loadError: string | null;
  onSave: (input: { rule: RecurrenceRule; seriesEndsAt: string }) => Promise<string | null>;
  isSaving: boolean;
};

export function EditRecurrenceSeriesModal({
  open,
  onClose,
  onSaved,
  recurrence,
  isLoading,
  loadError,
  onSave,
  isSaving,
}: EditRecurrenceSeriesModalProps) {
  const [rule, setRule] = useState<RecurrenceRule | null>(null);
  const [seriesEndsAt, setSeriesEndsAt] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!recurrence) {
      setRule(null);
      setSeriesEndsAt('');
      setSaveError(null);
      return;
    }

    setRule(recurrence.rule);
    setSeriesEndsAt(recurrence.seriesEndsAt.split('T')[0] ?? recurrence.seriesEndsAt);
    setSaveError(null);
  }, [recurrence]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!rule) {
      return;
    }

    setSaveError(null);
    const error = await onSave({ rule, seriesEndsAt });
    if (error) {
      setSaveError(error);
      return;
    }
    onSaved();
  }

  const startsAtLocal = recurrence ? toDatetimeLocalValue(recurrence.seriesStartsAt) : '';

  return (
    <Modal open={open} onClose={onClose} title="Editar série">
      {isLoading ? (
        <p className="text-sm text-muted">Carregando série…</p>
      ) : loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : recurrence && rule ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <p className="text-sm text-muted">
            Apenas eventos futuros serão afetados.
          </p>

          <RecurrenceFormFields
            startsAtLocal={startsAtLocal}
            rule={rule}
            onRuleChange={setRule}
            seriesEndsAt={seriesEndsAt}
            onSeriesEndsAtChange={setSeriesEndsAt}
            disabled={isSaving}
          />

          {saveError && (
            <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isSaving ? 'Salvando…' : 'Salvar série'}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
