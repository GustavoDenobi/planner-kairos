import {
  highlightBrushPreviewPixels,
  penStrokePreviewPixels,
} from '@/ui/features/repertoire/highlight-brush';
import type { AnnotationToolKind } from '@/ui/features/repertoire/AnnotationToolOptions';

type AnnotationBrushPreviewProps = {
  tool: AnnotationToolKind;
  color: string;
  strokeWidth: number;
  pageRenderWidth: number;
  inverted: boolean;
};

export function AnnotationBrushPreview({
  tool,
  color,
  strokeWidth,
  pageRenderWidth,
  inverted,
}: AnnotationBrushPreviewProps) {
  const paperClass = inverted ? 'bg-neutral-900' : 'bg-white';
  const blendMode = tool === 'highlight' ? (inverted ? 'screen' : 'multiply') : undefined;

  if (tool === 'pen') {
    const diameter = penStrokePreviewPixels(strokeWidth, pageRenderWidth);

    return (
      <div
        className="flex h-20 w-28 items-center justify-center rounded-lg border border-border bg-surface shadow-md"
        role="status"
        aria-live="polite"
        aria-label={`Prévia da caneta, espessura ${Math.round(diameter)} pixels`}
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

  const brushSize = highlightBrushPreviewPixels(strokeWidth, pageRenderWidth);

  return (
    <div
      className="flex h-20 w-28 items-center justify-center rounded-lg border border-border bg-surface shadow-md"
      role="status"
      aria-live="polite"
      aria-label={`Prévia do marca-texto, espessura ${Math.round(brushSize.width)} por ${Math.round(brushSize.height)} pixels`}
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
