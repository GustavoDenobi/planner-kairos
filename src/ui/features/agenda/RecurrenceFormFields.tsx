import type { RecurrenceRule } from '@/domain/agenda';
import { formatRecurrencePreview, maxRecurrenceEndDateInputValue } from '@/domain/agenda';
import { toDateInputValue } from '@/ui/features/agenda/agenda-date';

const WEEKDAY_LABELS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

type RecurrenceFormFieldsProps = {
  startsAtLocal: string;
  rule: RecurrenceRule;
  onRuleChange: (rule: RecurrenceRule) => void;
  seriesEndsAt: string;
  onSeriesEndsAtChange: (value: string) => void;
  disabled?: boolean;
};

const fieldClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text disabled:opacity-60';

function defaultSeriesEndsAt(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return toDateInputValue(date);
}

export function createDefaultRecurrenceRule(startsAtLocal: string): RecurrenceRule {
  const weekday = new Date(startsAtLocal).getDay();
  return {
    frequency: 'weekly',
    interval: 1,
    byWeekday: [weekday],
  };
}

export function createDefaultSeriesEndsAt(): string {
  return defaultSeriesEndsAt();
}

export function RecurrenceFormFields({
  startsAtLocal,
  rule,
  onRuleChange,
  seriesEndsAt,
  onSeriesEndsAtChange,
  disabled = false,
}: RecurrenceFormFieldsProps) {
  const minEndDate = startsAtLocal.split('T')[0] ?? toDateInputValue(new Date());
  const maxEndDate = maxRecurrenceEndDateInputValue();
  const preview = formatRecurrencePreview(rule, seriesEndsAt);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-bg/40 p-3">
      <p className="text-sm font-medium text-text">Repetição</p>

      <label className="block">
        <span className="mb-1 block text-sm text-muted">Frequência</span>
        <select
          value={rule.frequency}
          onChange={(event) => {
            const frequency = event.target.value;
            if (frequency === 'weekly') {
              onRuleChange(createDefaultRecurrenceRule(startsAtLocal));
              return;
            }
            onRuleChange({
              frequency: 'monthly',
              mode: 'dayOfMonth',
              day: new Date(startsAtLocal).getDate(),
              interval: 1,
            });
          }}
          disabled={disabled}
          className={fieldClass}
        >
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm text-muted">Intervalo</span>
        <input
          type="number"
          min={1}
          value={rule.interval}
          onChange={(event) => {
            const interval = Math.max(1, Number(event.target.value) || 1);
            onRuleChange({ ...rule, interval });
          }}
          disabled={disabled}
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-muted">
          {rule.frequency === 'weekly'
            ? 'A cada quantas semanas'
            : 'A cada quantos meses'}
        </span>
      </label>

      {rule.frequency === 'weekly' && (
        <fieldset>
          <legend className="mb-2 block text-sm text-muted">Dias da semana</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((item) => {
              const selected = rule.byWeekday.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const next = selected
                      ? rule.byWeekday.filter((day) => day !== item.value)
                      : [...rule.byWeekday, item.value];
                    onRuleChange({ ...rule, byWeekday: next.length > 0 ? next : [item.value] });
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {rule.frequency === 'monthly' && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Modo mensal</span>
            <select
              value={rule.mode}
              onChange={(event) => {
                const mode = event.target.value;
                if (mode === 'dayOfMonth') {
                  onRuleChange({
                    frequency: 'monthly',
                    mode: 'dayOfMonth',
                    day: new Date(startsAtLocal).getDate(),
                    interval: rule.interval,
                  });
                  return;
                }
                onRuleChange({
                  frequency: 'monthly',
                  mode: 'nthWeekday',
                  weekday: new Date(startsAtLocal).getDay(),
                  nth: 1,
                  interval: rule.interval,
                });
              }}
              disabled={disabled}
              className={fieldClass}
            >
              <option value="dayOfMonth">Dia do mês</option>
              <option value="nthWeekday">Enésimo dia da semana</option>
            </select>
          </label>

          {rule.mode === 'dayOfMonth' ? (
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Dia do mês</span>
              <input
                type="number"
                min={1}
                max={31}
                value={rule.day}
                onChange={(event) =>
                  onRuleChange({
                    ...rule,
                    day: Math.min(31, Math.max(1, Number(event.target.value) || 1)),
                  })
                }
                disabled={disabled}
                className={fieldClass}
              />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Ocorrência</span>
                <select
                  value={rule.nth}
                  onChange={(event) =>
                    onRuleChange({ ...rule, nth: Number(event.target.value) })
                  }
                  disabled={disabled}
                  className={fieldClass}
                >
                  <option value={1}>1ª</option>
                  <option value={2}>2ª</option>
                  <option value={3}>3ª</option>
                  <option value={4}>4ª</option>
                  <option value={5}>5ª</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-muted">Dia da semana</span>
                <select
                  value={rule.weekday}
                  onChange={(event) =>
                    onRuleChange({ ...rule, weekday: Number(event.target.value) })
                  }
                  disabled={disabled}
                  className={fieldClass}
                >
                  {WEEKDAY_LABELS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm text-muted">Repetir até *</span>
        <input
          type="date"
          value={seriesEndsAt}
          min={minEndDate}
          max={maxEndDate}
          onChange={(event) => onSeriesEndsAtChange(event.target.value)}
          disabled={disabled}
          required
          className={fieldClass}
        />
      </label>

      <p className="text-sm text-muted">{preview}</p>
    </div>
  );
}
