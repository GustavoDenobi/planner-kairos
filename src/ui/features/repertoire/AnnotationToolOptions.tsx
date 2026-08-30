import { useEffect, useState } from 'react';
import {
  HIGHLIGHT_COLOR_PRESETS,
  HIGHLIGHT_STROKE_WIDTH,
  PEN_COLOR_PRESETS,
  PEN_STROKE_WIDTH,
  resolvePresetVisualStroke,
  type StrokeWidthRange,
} from '@/domain/repertoire';
import { AnnotationBrushPreview } from '@/ui/features/repertoire/AnnotationBrushPreview';

export type AnnotationToolKind = 'pen' | 'highlight';

type AnnotationToolOptionsProps = {
  tool: AnnotationToolKind;
  inverted: boolean;
  selectedPresetId: string;
  strokeWidth: number;
  onPresetChange: (presetId: string) => void;
  onStrokeWidthChange: (strokeWidth: number) => void;
};

function presetsForTool(tool: AnnotationToolKind) {
  return tool === 'pen' ? PEN_COLOR_PRESETS : HIGHLIGHT_COLOR_PRESETS;
}

function strokeRangeForTool(tool: AnnotationToolKind): StrokeWidthRange {
  return tool === 'pen' ? PEN_STROKE_WIDTH : HIGHLIGHT_STROKE_WIDTH;
}

function annotationTypeForTool(tool: AnnotationToolKind): 'stroke' | 'highlight' {
  return tool === 'pen' ? 'stroke' : 'highlight';
}

export function AnnotationToolOptions({
  tool,
  inverted,
  selectedPresetId,
  strokeWidth,
  onPresetChange,
  onStrokeWidthChange,
}: AnnotationToolOptionsProps) {
  const presets = presetsForTool(tool);
  const range = strokeRangeForTool(tool);
  const type = annotationTypeForTool(tool);
  const sliderId = `annotation-${tool}-stroke-width`;
  const [showBrushPreview, setShowBrushPreview] = useState(false);
  const previewColor = resolvePresetVisualStroke(type, selectedPresetId, inverted);

  useEffect(() => {
    if (!showBrushPreview) {
      return;
    }

    const hidePreview = () => setShowBrushPreview(false);
    window.addEventListener('pointerup', hidePreview);
    window.addEventListener('pointercancel', hidePreview);

    return () => {
      window.removeEventListener('pointerup', hidePreview);
      window.removeEventListener('pointercancel', hidePreview);
    };
  }, [showBrushPreview]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      <div
        className="flex items-center gap-1.5"
        role="group"
        aria-label={tool === 'pen' ? 'Cor da caneta' : 'Cor do marca-texto'}
      >
        {presets.map((preset) => {
          const isActive = preset.id === selectedPresetId;
          const swatchColor = resolvePresetVisualStroke(type, preset.id, inverted);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPresetChange(preset.id)}
              aria-label={preset.label}
              aria-pressed={isActive}
              title={preset.label}
              className={`h-7 w-7 shrink-0 rounded-full border-2 ${
                isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border'
              }`}
              style={{ backgroundColor: swatchColor }}
            />
          );
        })}
      </div>
      <div className="relative">
        {showBrushPreview && (
          <div className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2">
            <AnnotationBrushPreview
              tool={tool}
              color={previewColor}
              strokeWidth={strokeWidth}
              range={range}
              inverted={inverted}
            />
          </div>
        )}
        <label htmlFor={sliderId} className="flex items-center gap-2 text-sm text-muted">
          <span className="whitespace-nowrap">Espessura</span>
          <input
            id={sliderId}
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={strokeWidth}
            onPointerDown={() => setShowBrushPreview(true)}
            onChange={(event) => onStrokeWidthChange(Number(event.target.value))}
            aria-valuemin={range.min}
            aria-valuemax={range.max}
            aria-valuenow={strokeWidth}
            className="w-24 shrink-0 accent-primary sm:w-28"
          />
        </label>
      </div>
    </div>
  );
}
