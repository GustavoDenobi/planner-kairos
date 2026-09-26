import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TextFontFamily, TextGeometry } from '@/domain/repertoire';
import {
  DEFAULT_TEXT_FONT_FAMILY,
  TEXT_ANNOTATION_MAX_LENGTH,
  TEXT_FONT_FAMILY_LABELS,
  TEXT_FONT_SIZE,
  clampStrokeWidth,
  nextTextFontFamily,
  normalizeTextFontFamily,
  resolvePresetVisualStroke,
} from '@/domain/repertoire';
import { IconItalic, IconTrash } from '@/ui/components/icons';
import {
  computeViewportClampOffset,
  getContainingClipRect,
} from '@/ui/features/repertoire/floating-panel-position';
import { MusicalSymbolPanel } from '@/ui/features/repertoire/MusicalSymbolPalette';
import { TextAnnotationColorPicker } from '@/ui/features/repertoire/TextAnnotationColorPicker';
import {
  resolveAnnotationTextFontFamily,
  resolveTextFontStack,
  textFontSizePixels,
} from '@/ui/features/repertoire/annotation-text-metrics';
import { ensureSmuflFontLoaded } from '@/ui/features/repertoire/smufl-font-loader';

export type TextAnnotationEditSession = {
  pageNumber: number;
  geometry: TextGeometry;
  colorPresetId: string;
  editingId?: string;
};

type TextAnnotationEditorProps = {
  session: TextAnnotationEditSession;
  pageWidth: number;
  inverted: boolean;
  onCommit: (session: TextAnnotationEditSession) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onStylePreferenceChange?: (prefs: {
    textPresetId: string;
    textFontSize: number;
    textFontFamily: TextFontFamily;
  }) => void;
  registerFlush?: (flush: () => void) => () => void;
};

function normalizeTextGeometry(geometry: TextGeometry, content: string): TextGeometry {
  const fontFamily = normalizeTextFontFamily(geometry.fontFamily);
  return {
    ...geometry,
    content,
    fontFamily: fontFamily === DEFAULT_TEXT_FONT_FAMILY ? undefined : fontFamily,
    fontWeight: geometry.fontWeight === 'bold' ? 'bold' : undefined,
    fontStyle: geometry.fontStyle === 'italic' ? 'italic' : undefined,
  };
}

export function TextAnnotationEditor({
  session,
  pageWidth,
  inverted,
  onCommit,
  onCancel,
  onDelete,
  onStylePreferenceChange,
  registerFlush,
}: TextAnnotationEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(session.geometry.content);
  const [geometry, setGeometry] = useState(session.geometry);
  const [colorPresetId, setColorPresetId] = useState(session.colorPresetId);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const fontSizePx = textFontSizePixels(geometry.fontSize, pageWidth);
  const editorFontSizePx = Math.max(fontSizePx, 16);
  const displayColor = resolvePresetVisualStroke('text', colorPresetId, inverted);
  const sizeSliderId = 'text-annotation-font-size';
  const selectedFontFamily = normalizeTextFontFamily(geometry.fontFamily);

  useEffect(() => {
    textareaRef.current?.focus();
    const length = textareaRef.current?.value.length ?? 0;
    textareaRef.current?.setSelectionRange(length, length);
  }, []);

  useEffect(() => {
    if (symbolsOpen) {
      void ensureSmuflFontLoaded();
    }
  }, [symbolsOpen]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    const maxHeight = editorFontSizePx * 1.2 * 4;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [content, editorFontSizePx, geometry.fontStyle, geometry.fontWeight, selectedFontFamily]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    function clampToViewport() {
      const el = rootRef.current;
      if (!el) {
        return;
      }

      el.style.transform = '';
      const clip = getContainingClipRect(el);
      el.style.maxWidth = `${Math.min(320, clip.width)}px`;
      const panel = el.firstElementChild;
      if (panel instanceof HTMLElement) {
        panel.style.maxHeight = `${clip.height}px`;
      }
      const offset = computeViewportClampOffset(el.getBoundingClientRect(), clip);
      el.style.transform =
        offset.x !== 0 || offset.y !== 0 ? `translate(${offset.x}px, ${offset.y}px)` : '';
    }

    clampToViewport();

    const observer = new ResizeObserver(clampToViewport);
    observer.observe(root);
    window.addEventListener('resize', clampToViewport);
    window.addEventListener('scroll', clampToViewport, true);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', clampToViewport);
    visualViewport?.addEventListener('scroll', clampToViewport);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', clampToViewport);
      window.removeEventListener('scroll', clampToViewport, true);
      visualViewport?.removeEventListener('resize', clampToViewport);
      visualViewport?.removeEventListener('scroll', clampToViewport);
    };
  }, [content, editorFontSizePx, session.geometry.x, session.geometry.y, symbolsOpen]);

  const notifyStylePreferenceChange = useCallback(
    (next: TextGeometry, nextColorPresetId: string) => {
      onStylePreferenceChange?.({
        textPresetId: nextColorPresetId,
        textFontSize: next.fontSize,
        textFontFamily: normalizeTextFontFamily(next.fontFamily),
      });
    },
    [onStylePreferenceChange],
  );

  const updateGeometry = useCallback(
    (next: TextGeometry) => {
      setGeometry(next);
      notifyStylePreferenceChange(next, colorPresetId);
    },
    [colorPresetId, notifyStylePreferenceChange],
  );

  const updateColorPreset = useCallback(
    (nextPresetId: string) => {
      setColorPresetId(nextPresetId);
      notifyStylePreferenceChange(geometry, nextPresetId);
    },
    [geometry, notifyStylePreferenceChange],
  );

  const handleCommit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      onCancel();
      return;
    }

    onCommit({
      ...session,
      colorPresetId,
      geometry: normalizeTextGeometry(geometry, trimmed.slice(0, TEXT_ANNOTATION_MAX_LENGTH)),
    });
  }, [colorPresetId, content, geometry, onCancel, onCommit, session]);

  useEffect(() => {
    if (!registerFlush) {
      return;
    }
    return registerFlush(handleCommit);
  }, [handleCommit, registerFlush]);

  const insertSymbol = useCallback((char: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((current) => `${current}${char}`.slice(0, TEXT_ANNOTATION_MAX_LENGTH));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setContent((current) => {
      const next = `${current.slice(0, start)}${char}${current.slice(end)}`;
      return next.slice(0, TEXT_ANNOTATION_MAX_LENGTH);
    });

    requestAnimationFrame(() => {
      const nextPos = start + char.length;
      textarea.setSelectionRange(nextPos, nextPos);
      textarea.focus();
    });
  }, []);

  const toggleBold = useCallback(() => {
    updateGeometry({
      ...geometry,
      fontWeight: geometry.fontWeight === 'bold' ? undefined : 'bold',
    });
  }, [geometry, updateGeometry]);

  const toggleItalic = useCallback(() => {
    updateGeometry({
      ...geometry,
      fontStyle: geometry.fontStyle === 'italic' ? undefined : 'italic',
    });
  }, [geometry, updateGeometry]);

  const cycleFontFamily = useCallback(() => {
    updateGeometry({
      ...geometry,
      fontFamily: nextTextFontFamily(selectedFontFamily),
    });
  }, [geometry, selectedFontFamily, updateGeometry]);

  return (
    <div
      ref={rootRef}
      className="absolute z-40 min-w-52 max-w-[min(20rem,calc(100vw-1rem))]"
      style={{
        left: `${session.geometry.x * 100}%`,
        top: `${session.geometry.y * 100}%`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex max-h-[calc(var(--app-vh,100dvh)-1rem)] flex-col gap-1 overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
        <div className="border-b border-border px-1 pb-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <TextAnnotationColorPicker
              selectedPresetId={colorPresetId}
              inverted={inverted}
              onSelect={updateColorPreset}
            />
            <label htmlFor={sizeSliderId} className="flex min-w-24 flex-1 items-center gap-1.5 text-xs text-muted">
              <span className="whitespace-nowrap">Tamanho</span>
              <input
                id={sizeSliderId}
                type="range"
                min={TEXT_FONT_SIZE.min}
                max={TEXT_FONT_SIZE.max}
                step={TEXT_FONT_SIZE.step}
                value={geometry.fontSize}
                onChange={(event) =>
                  updateGeometry({
                    ...geometry,
                    fontSize: clampStrokeWidth(Number(event.target.value), TEXT_FONT_SIZE),
                  })
                }
                aria-valuemin={TEXT_FONT_SIZE.min}
                aria-valuemax={TEXT_FONT_SIZE.max}
                aria-valuenow={geometry.fontSize}
                className="min-w-0 flex-1 accent-primary"
              />
            </label>
            <button
              type="button"
              onClick={cycleFontFamily}
              aria-label={`Fonte: ${TEXT_FONT_FAMILY_LABELS[selectedFontFamily]}`}
              title={`Fonte: ${TEXT_FONT_FAMILY_LABELS[selectedFontFamily]}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-base leading-none text-text"
              style={{ fontFamily: resolveTextFontStack(selectedFontFamily) }}
            >
              F
            </button>
            <div className="flex items-center gap-0.5" role="group" aria-label="Estilo do texto">
              <button
                type="button"
                onClick={toggleBold}
                aria-label="Negrito"
                aria-pressed={geometry.fontWeight === 'bold'}
                title="Negrito"
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${
                  geometry.fontWeight === 'bold'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text'
                }`}
              >
                <span className="text-sm font-bold leading-none">B</span>
              </button>
              <button
                type="button"
                onClick={toggleItalic}
                aria-label="Itálico"
                aria-pressed={geometry.fontStyle === 'italic'}
                title="Itálico"
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${
                  geometry.fontStyle === 'italic'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text'
                }`}
              >
                <IconItalic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSymbolsOpen((current) => !current)}
                aria-label="Inserir símbolo musical"
                aria-expanded={symbolsOpen}
                aria-haspopup="listbox"
                title="Símbolos musicais"
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-sm ${
                  symbolsOpen
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text'
                }`}
              >
                ♫
              </button>
            </div>
          </div>
          {symbolsOpen ? <MusicalSymbolPanel onInsert={insertSymbol} /> : null}
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(event) =>
            setContent(event.target.value.slice(0, TEXT_ANNOTATION_MAX_LENGTH))
          }
          rows={1}
          aria-label="Texto da anotação"
          className="min-w-44 resize-none border-0 bg-transparent p-1 text-text outline-none"
          style={{
            fontFamily: resolveAnnotationTextFontFamily(selectedFontFamily),
            fontSize: `${editorFontSizePx}px`,
            color: displayColor,
            fontWeight: geometry.fontWeight === 'bold' ? 'bold' : 'normal',
            fontStyle: geometry.fontStyle === 'italic' ? 'italic' : 'normal',
            lineHeight: 1.2,
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleCommit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              if (symbolsOpen) {
                setSymbolsOpen(false);
                return;
              }
              onCancel();
            }
          }}
        />
        <div className="flex items-center gap-1">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Apagar anotação"
              title="Apagar"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-2 py-1 text-xs text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCommit}
              className="rounded-lg bg-primary px-2 py-1 text-xs text-white"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
