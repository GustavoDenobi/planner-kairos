import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { IconCheck, IconPencil, IconPlus } from '@/ui/components/icons';

const VIEWPORT_MARGIN_PX = 8;

function clampPanelPosition(triggerRect: DOMRect, panelRect: DOMRect): CSSProperties {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxWidth = Math.min(panelRect.width, viewportWidth - VIEWPORT_MARGIN_PX * 2);

  let left = triggerRect.left;
  const maxLeft = viewportWidth - maxWidth - VIEWPORT_MARGIN_PX;
  left = Math.max(VIEWPORT_MARGIN_PX, Math.min(left, maxLeft));

  let top = triggerRect.bottom + 4;
  if (top + panelRect.height > viewportHeight - VIEWPORT_MARGIN_PX) {
    top = triggerRect.top - panelRect.height - 4;
  }
  top = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(top, viewportHeight - panelRect.height - VIEWPORT_MARGIN_PX),
  );

  return {
    position: 'fixed',
    top,
    left,
    width: maxWidth,
  };
}

export type LayerVisibilityOption = {
  id: string;
  label: string;
  visible: boolean;
  canEdit?: boolean;
  editValue?: string;
};

type AnnotationLayerVisibilityDropdownProps = {
  options: LayerVisibilityOption[];
  onToggle: (id: string) => void;
  onEditLayer?: (editValue: string) => void;
  onCreateLayer?: () => void;
  activeEditValue?: string | null;
  isAnnotating?: boolean;
  buttonClassName?: string;
};

export function AnnotationLayerVisibilityDropdown({
  options,
  onToggle,
  onEditLayer,
  onCreateLayer,
  activeEditValue = null,
  isAnnotating = false,
  buttonClassName,
}: AnnotationLayerVisibilityDropdownProps) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }

    function updatePanelPosition() {
      const trigger = ref.current;
      const panel = panelRef.current;
      if (!trigger || !panel) {
        return;
      }

      setPanelStyle(
        clampPanelPosition(trigger.getBoundingClientRect(), panel.getBoundingClientRect()),
      );
    }

    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);

    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, options.length]);

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
  const activeEditLabel =
    isAnnotating && activeEditValue
      ? options.find((option) => option.editValue === activeEditValue)?.label
      : null;
  const accessibilityLabel = isAnnotating
    ? activeEditLabel
      ? `Editando camada ${activeEditLabel}`
      : 'Camadas de anotação'
    : allVisible
      ? 'Camadas visíveis'
      : `Camadas visíveis (${visibleCount}/${options.length})`;

  function handleEditLayer(editValue: string) {
    onEditLayer?.(editValue);
    setOpen(false);
  }

  function handleCreateLayer() {
    onCreateLayer?.();
    setOpen(false);
  }

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
          isAnnotating
            ? 'inline-flex h-9 max-w-[min(12rem,40vw)] shrink-0 items-center gap-2 rounded-lg border border-primary bg-primary/10 px-2.5 text-sm text-primary'
            : buttonClassName ??
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text'
        }
      >
        <IconPencil className="h-4 w-4 shrink-0" />
        {activeEditLabel ? <span className="truncate">{activeEditLabel}</span> : null}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="listbox"
          aria-label="Camadas"
          style={
            panelStyle ?? {
              position: 'fixed',
              top: 0,
              left: 0,
              visibility: 'hidden',
            }
          }
          className="z-30 max-h-80 min-w-[14rem] max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isActive = Boolean(
              option.editValue && activeEditValue && option.editValue === activeEditValue,
            );

            return (
              <div
                key={option.editValue ?? `${option.id}-${index}`}
                role="option"
                aria-selected={isActive}
                className={`flex w-full items-center gap-2 px-2 py-1.5 ${
                  isActive ? 'bg-primary/5' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(option.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-bg ${
                    option.visible ? 'text-text' : 'text-muted'
                  }`}
                  aria-label={`${option.visible ? 'Ocultar' : 'Mostrar'} camada ${option.label}`}
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

                {option.canEdit && option.editValue && onEditLayer ? (
                  <button
                    type="button"
                    onClick={() => handleEditLayer(option.editValue!)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text hover:bg-bg"
                    aria-label={`Editar camada ${option.label}`}
                    title={`Editar ${option.label}`}
                  >
                    <IconPencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}

          {onCreateLayer ? (
            <div className="border-t border-border px-2 py-1.5">
              <button
                type="button"
                onClick={handleCreateLayer}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-primary hover:bg-bg"
              >
                <IconPlus className="h-4 w-4 shrink-0" />
                Criar camada
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
