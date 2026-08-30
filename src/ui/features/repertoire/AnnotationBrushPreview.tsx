import {
  fitRectToBounds,
  HIGHLIGHT_BRUSH_HEIGHT_RATIO,
  HIGHLIGHT_BRUSH_WIDTH_SCALE,
  strokeWidthToPreviewPixels,
} from '@/ui/features/repertoire/highlight-brush';
import type { AnnotationToolKind } from '@/ui/features/repertoire/AnnotationToolOptions';
import type { StrokeWidthRange } from '@/domain/repertoire';

/** Inner paper area of the preview card (px), with room for border/padding. */
const PREVIEW_PAPER_WIDTH_PX = 72;
const PREVIEW_PAPER_HEIGHT_PX = 48;

type AnnotationBrushPreviewProps = {
  tool: AnnotationToolKind;
  color: string;
  strokeWidth: number;
  range: StrokeWidthRange;
  inverted: boolean;
};

export function AnnotationBrushPreview({
  tool,
  color,
  strokeWidth,
  range,
  inverted,
}: AnnotationBrushPreviewProps) {
  const paperClass = inverted ? 'bg-neutral-900' : 'bg-white';
  const blendMode = tool === 'highlight' ? (inverted ? 'screen' : 'multiply') : undefined;

  if (tool === 'pen') {
    const rawDiameter = strokeWidthToPreviewPixels(strokeWidth, range.min, range.max, 4, 18);
    const diameter = fitRectToBounds(
      rawDiameter,
      rawDiameter,
      PREVIEW_PAPER_WIDTH_PX,
      PREVIEW_PAPER_HEIGHT_PX,
    ).width;

    return (
      <div
        className="flex h-20 w-28 items-center justify-center rounded-lg border border-border bg-surface shadow-md"
        role="status"
        aria-live="polite"
        aria-label={`Prévia da caneta, espessura ${Math.round(rawDiameter)} pixels`}
      >
        <div
          className={`flex h-14 w-20 items-center justify-center overflow-hidden rounded-md border border-border ${paperClass}`}
        >
          <span
            className="block shrink-0 rounded-full"
            style={{
              width: diameter,
              height: diameter,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
    );
  }

  const rawWidth = strokeWidthToPreviewPixels(strokeWidth, range.min, range.max, 10, 28) * HIGHLIGHT_BRUSH_WIDTH_SCALE;
  const rawHeight = rawWidth * HIGHLIGHT_BRUSH_HEIGHT_RATIO;
  const brushSize = fitRectToBounds(
    rawWidth,
    rawHeight,
    PREVIEW_PAPER_WIDTH_PX,
    PREVIEW_PAPER_HEIGHT_PX,
  );

  return (
    <div
      className="flex h-20 w-28 items-center justify-center rounded-lg border border-border bg-surface shadow-md"
      role="status"
      aria-live="polite"
      aria-label={`Prévia do marca-texto, espessura ${Math.round(rawWidth)} pixels`}
    >
      <div
        className={`flex h-14 w-20 items-center justify-center overflow-hidden rounded-md border border-border ${paperClass}`}
      >
        <span
          className="block shrink-0"
          style={{
            width: brushSize.width,
            height: brushSize.height,
            backgroundColor: color,
            mixBlendMode: blendMode,
          }}
        />
      </div>
    </div>
  );
}
