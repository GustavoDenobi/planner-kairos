import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  NOTE_BODY_MAX_LENGTH,
  NOTE_TITLE_MAX_LENGTH,
  type NoteGeometry,
} from '@/domain/repertoire';
import { IconTrash } from '@/ui/components/icons';
import {
  computeViewportClampOffset,
  getContainingClipRect,
} from '@/ui/features/repertoire/floating-panel-position';

export type NoteAnnotationEditSession = {
  pageNumber: number;
  geometry: NoteGeometry;
  editingId?: string;
};

type NoteAnnotationEditorProps = {
  session: NoteAnnotationEditSession;
  onCommit: (session: NoteAnnotationEditSession) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

export function NoteAnnotationEditor({
  session,
  onCommit,
  onCancel,
  onDelete,
}: NoteAnnotationEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(session.geometry.title ?? '');
  const [body, setBody] = useState(session.geometry.body);

  const handleCommit = useCallback(() => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle && !trimmedBody) {
      onCancel();
      return;
    }

    onCommit({
      ...session,
      geometry: {
        x: session.geometry.x,
        y: session.geometry.y,
        title: trimmedTitle ? trimmedTitle.slice(0, NOTE_TITLE_MAX_LENGTH) : undefined,
        body: trimmedBody.slice(0, NOTE_BODY_MAX_LENGTH),
      },
    });
  }, [body, onCancel, onCommit, session, title]);

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
      el.style.maxWidth = `${Math.min(360, clip.width)}px`;
      const offset = computeViewportClampOffset(el.getBoundingClientRect(), clip);
      el.style.transform =
        offset.x !== 0 || offset.y !== 0 ? `translate(${offset.x}px, ${offset.y}px)` : '';
    }

    clampToViewport();
    const observer = new ResizeObserver(clampToViewport);
    observer.observe(root);
    window.addEventListener('resize', clampToViewport);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', clampToViewport);
    };
  }, [body, title]);

  return (
    <div
      ref={rootRef}
      className="absolute z-50 w-[min(22rem,90%)]"
      style={{ left: `${session.geometry.x * 100}%`, top: `${session.geometry.y * 100}%` }}
    >
      <div className="rounded-lg border border-border bg-surface p-2 shadow-lg">
        <label className="mb-1 block text-xs text-muted" htmlFor="note-annotation-title">
          Título (opcional)
        </label>
        <input
          id="note-annotation-title"
          value={title}
          maxLength={NOTE_TITLE_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
          className="mb-2 w-full rounded border border-border bg-bg px-2 py-1 text-sm text-text"
          placeholder="Título"
        />
        <label className="mb-1 block text-xs text-muted" htmlFor="note-annotation-body">
          Texto
        </label>
        <textarea
          id="note-annotation-body"
          value={body}
          maxLength={NOTE_BODY_MAX_LENGTH}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          className="w-full resize-y rounded border border-border bg-bg px-2 py-1 text-sm text-text"
          placeholder="Markdown"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Excluir nota"
              title="Excluir nota"
              className="rounded p-1 text-muted hover:text-text"
            >
              <IconTrash className="h-4 w-4" />
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleCommit}
              className="rounded bg-primary px-2 py-1 text-xs text-white"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-border px-2 py-1 text-xs text-text"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
