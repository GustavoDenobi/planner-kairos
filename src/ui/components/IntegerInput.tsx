import { useState } from 'react';

type IntegerInputProps = {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onChange: (value: number) => void;
};

function parseDigits(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampInteger(value: number, min?: number, max?: number): number {
  let next = value;
  if (min != null) {
    next = Math.max(min, next);
  }
  if (max != null) {
    next = Math.min(max, next);
  }
  return next;
}

export function IntegerInput({
  id,
  value,
  min,
  max,
  disabled = false,
  required = false,
  className,
  onChange,
}: IntegerInputProps) {
  // O rascunho pode ficar vazio durante a edição. Ao sair, vazio ou fora
  // do intervalo volta ao último número válido.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      step={1}
      min={min}
      max={max}
      required={required}
      disabled={disabled}
      className={className}
      value={shown}
      onFocus={() => setDraft(shown)}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw !== '' && parseDigits(raw) == null) {
          event.target.value = shown;
          return;
        }
        setDraft(raw);
        const parsed = parseDigits(raw);
        if (parsed == null) {
          return;
        }
        if (min != null && parsed < min) {
          return;
        }
        if (max != null && parsed > max) {
          return;
        }
        if (parsed !== value) {
          onChange(parsed);
        }
      }}
      onBlur={(event) => {
        const raw = event.currentTarget.value;
        const parsed = parseDigits(raw);
        if (parsed != null) {
          const next = clampInteger(parsed, min, max);
          if (next !== value) {
            onChange(next);
          }
        }
        setDraft(null);
      }}
    />
  );
}
