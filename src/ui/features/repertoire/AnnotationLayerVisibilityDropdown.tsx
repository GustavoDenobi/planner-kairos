import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconLayers } from '@/ui/components/icons';

export type LayerVisibilityOption = {
  id: string;
  label: string;
  visible: boolean;
};

type AnnotationLayerVisibilityDropdownProps = {
  options: LayerVisibilityOption[];
  onToggle: (id: string) => void;
  buttonClassName?: string;
};

export function AnnotationLayerVisibilityDropdown({
  options,
  onToggle,
  buttonClassName,
}: AnnotationLayerVisibilityDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (options.length === 0) {
    return null;
  }

  const visibleCount = options.filter((option) => option.visible).length;
  const allVisible = visibleCount === options.length;
  const accessibilityLabel = allVisible
    ? 'Camadas visíveis'
    : `Camadas visíveis (${visibleCount}/${options.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={accessibilityLabel}
        title={accessibilityLabel}
        className={
          buttonClassName ??
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text'
        }
      >
        <IconLayers className="h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Camadas visíveis"
          className="absolute left-0 top-full z-30 mt-1 max-h-64 min-w-[12rem] max-w-[18rem] overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.visible}
              onClick={() => onToggle(option.id)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg ${
                option.visible ? 'text-text' : 'text-muted'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  option.visible
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface'
                }`}
                aria-hidden
              >
                {option.visible ? <IconCheck className="h-3 w-3" strokeWidth={3} /> : null}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
