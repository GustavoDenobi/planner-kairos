import { useEffect, useId, useRef, useState } from 'react';
import { IconCheck, IconChevronDown } from '@/ui/components/icons';

export type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectDropdownProps = {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Texto do gatilho quando nada está marcado (= sem filtro). */
  allLabel: string;
  /** Texto do gatilho com vários marcados, ex.: (n) => `${n} grupos`. */
  pluralLabel: (count: number) => string;
  className?: string;
};

/** Seleção múltipla em lista com checkboxes. Nada marcado significa "todos". */
export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  allLabel,
  pluralLabel,
  className = '',
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const selectedSet = new Set(selected);
  const selectedOptions = options.filter((option) => selectedSet.has(option.value));
  const summary =
    selectedOptions.length === 0
      ? allLabel
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : pluralLabel(selectedOptions.length);

  function toggle(value: string) {
    onChange(
      selectedSet.has(value)
        ? selected.filter((item) => item !== value)
        : options.filter((option) => option.value === value || selectedSet.has(option.value)).map(
            (option) => option.value,
          ),
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        aria-label={`${label}: ${summary}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-left text-base text-text"
      >
        <span className="truncate">{summary}</span>
        <IconChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div
          id={panelId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-bg"
          >
            <CheckMark checked={selected.length === 0} />
            {allLabel}
          </button>
          <div className="my-1 border-t border-border" />
          {options.map((option) => {
            const checked = selectedSet.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-bg"
              >
                <CheckMark checked={checked} />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
        checked ? 'border-primary bg-primary text-white' : 'border-border bg-surface'
      }`}
    >
      {checked && <IconCheck className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}
