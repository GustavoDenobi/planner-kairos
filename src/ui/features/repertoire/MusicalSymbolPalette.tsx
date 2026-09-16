import { useLayoutEffect, useRef } from 'react';
import {
  MUSICAL_SYMBOL_CATEGORIES,
  MUSICAL_SYMBOL_CATEGORY_LABELS,
  isSmuflPrivateUseCharacter,
  musicalSymbolsForCategory,
} from '@/domain/repertoire';
import {
  ANNOTATION_SMUFL_FONT_FAMILY,
  SMUFL_GLYPH_FONT_FAMILY,
} from '@/ui/features/repertoire/annotation-text-metrics';
import { useEnsureSmuflFont } from '@/ui/features/repertoire/useEnsureSmuflFont';

const GLYPH_MEASURE_PX = 64;
const GLYPH_BUTTON_PX = 36;
const GLYPH_TARGET_INK_PX = 20;
const STACCATO_TARGET_INK_PX = 8;

function glyphTargetInkPx(char: string): number {
  const codePoint = char.codePointAt(0);
  if (codePoint === 0xe4a2 || codePoint === 0xe4a3) {
    return STACCATO_TARGET_INK_PX;
  }
  return GLYPH_TARGET_INK_PX;
}

type MusicalSymbolPanelProps = {
  onInsert: (char: string) => void;
};

function CenteredSmuflGlyph({ char }: { char: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    const size = canvas.parentElement?.clientWidth || GLYPH_BUTTON_PX;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);
    context.font = `${GLYPH_MEASURE_PX}px "${ANNOTATION_SMUFL_FONT_FAMILY}"`;
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = getComputedStyle(canvas).color;

    const metrics = context.measureText(char);
    const inkWidth = Math.max(
      (metrics.actualBoundingBoxLeft ?? 0) + (metrics.actualBoundingBoxRight ?? 0),
      metrics.width,
      1,
    );
    const inkHeight = Math.max(
      (metrics.actualBoundingBoxAscent ?? 0) + (metrics.actualBoundingBoxDescent ?? 0),
      1,
    );
    const centerX = ((metrics.actualBoundingBoxRight ?? 0) - (metrics.actualBoundingBoxLeft ?? 0)) / 2;
    const centerY =
      ((metrics.actualBoundingBoxDescent ?? 0) - (metrics.actualBoundingBoxAscent ?? 0)) / 2;
    const scale = (size * (glyphTargetInkPx(char) / GLYPH_BUTTON_PX)) / Math.max(inkWidth, inkHeight);

    context.translate(size / 2, size / 2);
    context.scale(scale, scale);
    context.translate(-centerX, -centerY);
    context.fillText(char, 0, 0);
  }, [char]);

  return <canvas ref={canvasRef} className="pointer-events-none" aria-hidden="true" />;
}

export function MusicalSymbolPanel({ onInsert }: MusicalSymbolPanelProps) {
  const smuflFontReady = useEnsureSmuflFont();

  return (
    <div
      role="listbox"
      aria-label="Símbolos musicais"
      className="musical-symbol-glyph max-h-40 overflow-x-hidden overflow-y-auto border-t border-border pt-1"
      aria-busy={!smuflFontReady}
    >
      {MUSICAL_SYMBOL_CATEGORIES.map((category) => (
        <div key={category} className="mb-2 last:mb-0">
          <p className="mb-1 px-1 text-xs font-medium text-muted">
            {MUSICAL_SYMBOL_CATEGORY_LABELS[category]}
          </p>
          <div className="flex flex-wrap gap-1">
            {musicalSymbolsForCategory(category).map((symbol) => {
              const isSmufl = isSmuflPrivateUseCharacter(symbol.char);
              const showFallback = isSmufl && !smuflFontReady;
              const centerGlyph =
                isSmufl && smuflFontReady && (category === 'articulation' || category === 'strings');
              return (
                <button
                  key={symbol.id}
                  type="button"
                  role="option"
                  aria-label={symbol.label}
                  title={symbol.label}
                  onClick={() => onInsert(symbol.char)}
                  className={`inline-flex items-center justify-center rounded-lg border border-border text-text hover:bg-primary/10 ${
                    centerGlyph
                      ? 'h-9 w-9 overflow-hidden p-0 leading-none'
                      : isSmufl && smuflFontReady
                        ? 'min-h-9 min-w-9 px-2 leading-none'
                        : 'min-w-9 px-2 py-1 text-sm'
                  }`}
                  style={
                    isSmufl && smuflFontReady && !centerGlyph
                      ? { fontFamily: SMUFL_GLYPH_FONT_FAMILY, fontSize: '1.25rem' }
                      : undefined
                  }
                >
                  {showFallback ? (
                    symbol.label
                  ) : centerGlyph ? (
                    <CenteredSmuflGlyph char={symbol.char} />
                  ) : (
                    symbol.char
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
