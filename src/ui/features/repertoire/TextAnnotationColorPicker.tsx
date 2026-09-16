import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PEN_COLOR_PRESETS, resolvePresetVisualStroke } from '@/domain/repertoire';
import { computeFloatingPanelPosition } from '@/ui/features/repertoire/floating-panel-position';

type TextAnnotationColorPickerProps = {
  selectedPresetId: string;
  inverted: boolean;
  onSelect: (presetId: string) => void;
};

export function TextAnnotationColorPicker({
  selectedPresetId,
  inverted,
  onSelect,
}: TextAnnotationColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedPreset =
    PEN_COLOR_PRESETS.find((preset) => preset.id === selectedPresetId) ?? PEN_COLOR_PRESETS[0]!;
  const currentColor = resolvePresetVisualStroke('text', selectedPreset.id, inverted);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button || !panel) {
      return;
    }

    setPosition(
      computeFloatingPanelPosition(button.getBoundingClientRect(), panel.getBoundingClientRect()),
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const panel = open ? (
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Cores do texto"
      className="fixed z-[100] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-surface p-2 shadow-lg"
      style={
        position
          ? { top: position.top, left: position.left }
          : { top: -9999, left: -9999, opacity: 0, pointerEvents: 'none' as const }
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {PEN_COLOR_PRESETS.map((preset) => {
          const isActive = preset.id === selectedPresetId;
          const swatchColor = resolvePresetVisualStroke('text', preset.id, inverted);
          return (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-label={preset.label}
              aria-selected={isActive}
              title={preset.label}
              onClick={() => {
                onSelect(preset.id);
                setOpen(false);
              }}
              className={`h-7 w-7 shrink-0 rounded-full border-2 ${
                isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border'
              }`}
              style={{ backgroundColor: swatchColor }}
            />
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Cor do texto: ${selectedPreset.label}`}
        title={`Cor: ${selectedPreset.label}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-border"
        style={{ backgroundColor: currentColor }}
      />
      {panel && typeof document !== 'undefined' ? createPortal(panel, document.body) : null}
    </div>
  );
}
