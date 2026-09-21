import { useEffect, useState } from 'react';
import {
  COVER_STROKE_WIDTH,
  HIGHLIGHT_COLOR_PRESETS,
  HIGHLIGHT_STROKE_WIDTH,
  PEN_COLOR_PRESETS,
  PEN_STROKE_WIDTH,
  TEXT_FONT_SIZE,
  resolveCoverColor,
  resolvePresetVisualStroke,
  type StrokeWidthRange,
} from '@/domain/repertoire';
import { AnnotationBrushPreview } from '@/ui/features/repertoire/AnnotationBrushPreview';
import type { CoverDrawMode, HighlightStrokeMode } from '@/ui/features/repertoire/highlight-brush';

const DRAW_MODE_CYCLE: HighlightStrokeMode[] = ['free', 'horizontal', 'vertical', 'rect'];

const DRAW_MODE_LABELS: Record<HighlightStrokeMode, string> = {
  free: 'Livre',
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  rect: 'Retângulo',
};

const DRAW_MODE_ARIA: Record<HighlightStrokeMode, string> = {
  free: 'Traço livre',
  horizontal: 'Traço horizontal',
  vertical: 'Traço vertical',
  rect: 'Retângulo',
};

export type AnnotationToolKind = 'pen' | 'highlight' | 'cover' | 'text';

type AnnotationToolOptionsProps = {
  tool: AnnotationToolKind;
  inverted: boolean;
  selectedPresetId: string;
  strokeWidth: number;
  pageRenderWidth: number;
  highlightStrokeMode?: HighlightStrokeMode;
  coverDrawMode?: CoverDrawMode;
  onPresetChange: (presetId: string) => void;
  onStrokeWidthChange: (strokeWidth: number) => void;
  onHighlightStrokeModeChange?: (mode: HighlightStrokeMode) => void;
  onCoverDrawModeChange?: (mode: CoverDrawMode) => void;
};

function presetsForTool(tool: AnnotationToolKind) {
  if (tool === 'highlight') {
    return HIGHLIGHT_COLOR_PRESETS;
  }
  return PEN_COLOR_PRESETS;
}

function strokeRangeForTool(tool: AnnotationToolKind): StrokeWidthRange {
  if (tool === 'highlight') {
    return HIGHLIGHT_STROKE_WIDTH;
  }
  if (tool === 'cover') {
    return COVER_STROKE_WIDTH;
  }
  if (tool === 'text') {
    return TEXT_FONT_SIZE;
  }
  return PEN_STROKE_WIDTH;
}

function annotationTypeForTool(tool: AnnotationToolKind): 'stroke' | 'highlight' | 'text' {
  if (tool === 'highlight') {
    return 'highlight';
  }
  if (tool === 'text') {
    return 'text';
  }
  return 'stroke';
}

export function AnnotationToolOptions({
  tool,
  inverted,
  selectedPresetId,
  strokeWidth,
  pageRenderWidth,
  highlightStrokeMode = 'free',
  coverDrawMode = 'free',
  onPresetChange,
  onStrokeWidthChange,
  onHighlightStrokeModeChange,
  onCoverDrawModeChange,
}: AnnotationToolOptionsProps) {
  const presets = presetsForTool(tool);
  const range = strokeRangeForTool(tool);
  const type = annotationTypeForTool(tool);
  const sliderId = `annotation-${tool}-stroke-width`;
  const [showBrushPreview, setShowBrushPreview] = useState(false);
  const previewColor =
    tool === 'cover'
      ? resolveCoverColor(inverted)
      : resolvePresetVisualStroke(type, selectedPresetId, inverted);
  const showStrokePreview = tool === 'pen' || tool === 'highlight' || tool === 'cover';
  const activeDrawMode = tool === 'cover' ? coverDrawMode : highlightStrokeMode;
  const showStrokeWidth = activeDrawMode !== 'rect';

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
      {tool !== 'cover' ? (
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label={
            tool === 'pen' ? 'Cor da caneta' : tool === 'text' ? 'Cor do texto' : 'Cor do marca-texto'
          }
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
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span
            className="h-7 w-7 shrink-0 rounded border border-border"
            style={{ backgroundColor: resolveCoverColor(inverted) }}
            aria-hidden
          />
          <span>Cor do papel</span>
        </div>
      )}
      {showStrokeWidth ? (
        <div className="relative">
          {showStrokePreview && showBrushPreview && (
            <div className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2">
              <AnnotationBrushPreview
                tool={tool === 'cover' ? 'highlight' : tool}
                color={previewColor}
                strokeWidth={strokeWidth}
                pageRenderWidth={pageRenderWidth}
                inverted={inverted}
              />
            </div>
          )}
          <label htmlFor={sliderId} className="flex items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">
              {tool === 'text' ? 'Tamanho' : 'Espessura'}
            </span>
            <input
              id={sliderId}
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={strokeWidth}
              onPointerDown={() => {
                if (showStrokePreview) {
                  setShowBrushPreview(true);
                }
              }}
              onChange={(event) => onStrokeWidthChange(Number(event.target.value))}
              aria-valuemin={range.min}
              aria-valuemax={range.max}
              aria-valuenow={strokeWidth}
              className="w-24 shrink-0 accent-primary sm:w-28"
            />
          </label>
        </div>
      ) : null}
      {(tool === 'highlight' && onHighlightStrokeModeChange)
      || (tool === 'cover' && onCoverDrawModeChange) ? (
        <button
          type="button"
          onClick={() => {
            const currentIndex = DRAW_MODE_CYCLE.indexOf(activeDrawMode);
            const nextMode = DRAW_MODE_CYCLE[(currentIndex + 1) % DRAW_MODE_CYCLE.length]!;
            if (tool === 'highlight') {
              onHighlightStrokeModeChange?.(nextMode);
            } else {
              onCoverDrawModeChange?.(nextMode);
            }
          }}
          aria-pressed={activeDrawMode !== 'free'}
          aria-label={DRAW_MODE_ARIA[activeDrawMode]}
          title={DRAW_MODE_ARIA[activeDrawMode]}
          className={`rounded-lg border px-3 py-1 text-sm ${
            activeDrawMode !== 'free'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-text'
          }`}
        >
          {DRAW_MODE_LABELS[activeDrawMode]}
        </button>
      ) : null}
    </div>
  );
}
