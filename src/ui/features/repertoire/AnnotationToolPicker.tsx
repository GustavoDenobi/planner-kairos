import { useEffect, useRef, useState, type ComponentType } from 'react';
import type { AnnotationInteractionMode } from '@/ui/features/repertoire/AnnotationOverlay';
import {
  IconEraser,
  IconHighlighter,
  IconLaser,
  IconPen,
} from '@/ui/components/icons';

type AnnotationDrawMode = Exclude<AnnotationInteractionMode, 'read'>;

type AnnotationToolPickerProps = {
  interactionMode: AnnotationDrawMode;
  onSelect: (mode: AnnotationDrawMode) => void;
  buttonClassName: (active?: boolean) => string;
};

const ANNOTATION_TOOLS: Array<{
  mode: AnnotationDrawMode;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}> = [
  { mode: 'pen', label: 'Caneta', Icon: IconPen },
  { mode: 'highlight', label: 'Marca-texto', Icon: IconHighlighter },
  { mode: 'laser', label: 'Laser', Icon: IconLaser },
  { mode: 'eraser', label: 'Borracha', Icon: IconEraser },
];

function findTool(mode: AnnotationDrawMode) {
  return ANNOTATION_TOOLS.find((tool) => tool.mode === mode) ?? ANNOTATION_TOOLS[0];
}

export function AnnotationToolPicker({
  interactionMode,
  onSelect,
  buttonClassName,
}: AnnotationToolPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeTool = findTool(interactionMode);
  const ActiveToolIcon = activeTool.Icon;

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

  function handleSelect(mode: AnnotationDrawMode) {
    onSelect(mode);
    setOpen(false);
  }

  return (
    <>
      <div ref={ref} className="relative lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`Ferramenta: ${activeTool.label}`}
          title={activeTool.label}
          className={buttonClassName(true)}
        >
          <ActiveToolIcon className="h-4 w-4" />
        </button>

        {open ? (
          <div
            role="listbox"
            aria-label="Ferramentas de anotação"
            className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
          >
            <div className="flex items-center gap-1">
              {ANNOTATION_TOOLS.map(({ mode, label, Icon }) => {
                const isActive = interactionMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    aria-label={label}
                    title={label}
                    onClick={() => handleSelect(mode)}
                    className={buttonClassName(isActive)}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden items-center gap-x-3 lg:flex">
        {ANNOTATION_TOOLS.map(({ mode, label, Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            aria-pressed={interactionMode === mode}
            aria-label={label}
            title={label}
            className={buttonClassName(interactionMode === mode)}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </>
  );
}
