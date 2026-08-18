import type { EventType } from '@/domain/agenda';

type EventFormFieldsProps = {
  types: EventType[];
  typeId: string;
  onTypeIdChange: (typeId: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  startsAt: string;
  onStartsAtChange: (value: string) => void;
  endsAt: string;
  onEndsAtChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  disabled?: boolean;
};

const fieldClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text disabled:opacity-60';

export function EventFormFields({
  types,
  typeId,
  onTypeIdChange,
  title,
  onTitleChange,
  startsAt,
  onStartsAtChange,
  endsAt,
  onEndsAtChange,
  notes,
  onNotesChange,
  disabled = false,
}: EventFormFieldsProps) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Tipo</span>
        <select
          value={typeId}
          onChange={(event) => onTypeIdChange(event.target.value)}
          disabled={disabled}
          className={fieldClass}
        >
          <option value="">Selecione…</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm text-muted">Título (opcional)</span>
        <input
          type="text"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={disabled}
          placeholder="Ex.: Cantata de Natal"
          className={fieldClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Início</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => onStartsAtChange(event.target.value)}
            disabled={disabled}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Término (opcional)</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => onEndsAtChange(event.target.value)}
            disabled={disabled}
            className={fieldClass}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-muted">Observações</span>
        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          disabled={disabled}
          rows={3}
          className={fieldClass}
        />
      </label>
    </div>
  );
}
