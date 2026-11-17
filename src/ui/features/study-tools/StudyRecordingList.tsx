import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { StudyRecordingRecord } from '@/infrastructure/pwa/db';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { computeFloatingPanelPosition } from '@/ui/features/repertoire/floating-panel-position';
import {
  IconDownload,
  IconMoreVertical,
  IconPause,
  IconPlay,
  IconShare,
  IconPencil,
  IconTrash,
} from '@/ui/components/icons';
import { Modal } from '@/ui/components/Modal';
import { STUDY_RECORDING_TITLE_MAX_LENGTH } from '@/infrastructure/pwa/study-recording-store';
import { useStudyRecordingSession } from '@/ui/features/study-tools/recording-session/recording-session-context';
import { formatTimerMs } from '@/ui/features/study-tools/study-timer-format';
import {
  canShareStudyRecording,
  downloadStudyRecording,
  isShareCancellation,
  shareStudyRecording,
} from '@/ui/features/study-tools/study-recording-delivery';
import { studyRecordingFileExtension } from '@/ui/features/study-tools/study-recording-format';

export const studyRecordingIconButtonClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text disabled:opacity-40';

const contextMenuItemClass =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-bg';

type RecordingRowProps = {
  record: StudyRecordingRecord;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
  canShare: boolean;
};

function computeRecordingMenuPosition(
  anchor: DOMRectReadOnly,
  panel: DOMRectReadOnly,
): { top: number; left: number } {
  const rightAlignedAnchor = new DOMRect(
    anchor.right - panel.width,
    anchor.top,
    panel.width,
    anchor.height,
  );
  return computeFloatingPanelPosition(rightAlignedAnchor, panel);
}

function RecordingRow({
  record,
  isPlaying,
  onTogglePlay,
  onDownload,
  onShare,
  onRename,
  onDelete,
  canShare,
}: RecordingRowProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const button = menuButtonRef.current;
    const panel = menuPanelRef.current;
    if (!button || !panel) {
      return;
    }

    setMenuPosition(computeRecordingMenuPosition(button.getBoundingClientRect(), panel.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target) || menuPanelRef.current?.contains(target)) {
        return;
      }
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  function runMenuAction(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const menuPanel =
    menuOpen && typeof document !== 'undefined' ? (
      <div
        ref={menuPanelRef}
        id={menuId}
        role="menu"
        className="fixed z-[100] min-w-[10.5rem] rounded-xl border border-border bg-surface py-1 shadow-lg"
        style={
          menuPosition
            ? { top: menuPosition.top, left: menuPosition.left }
            : { top: -9999, left: -9999, opacity: 0, pointerEvents: 'none' as const }
        }
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => runMenuAction(onRename)}
          className={contextMenuItemClass}
        >
          <IconPencil className="h-4 w-4 shrink-0" aria-hidden />
          Renomear
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => runMenuAction(onDownload)}
          className={contextMenuItemClass}
        >
          <IconDownload className="h-4 w-4 shrink-0" aria-hidden />
          Baixar
        </button>
        {canShare ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => runMenuAction(onShare)}
            className={contextMenuItemClass}
          >
            <IconShare className="h-4 w-4 shrink-0" aria-hidden />
            Compartilhar
          </button>
        ) : null}
        <button
          type="button"
          role="menuitem"
          onClick={() => runMenuAction(onDelete)}
          className={contextMenuItemClass}
        >
          <IconTrash className="h-4 w-4 shrink-0" aria-hidden />
          Excluir
        </button>
      </div>
    ) : null;

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{record.title}</p>
        <p className="text-xs text-muted tabular-nums">
          {formatTimerMs(record.durationMs)} ·{' '}
          {studyRecordingFileExtension(record.mimeType).toUpperCase()}
          {record.startPage ? ` · a partir da p. ${record.startPage}` : ''}
        </p>
        {record.practiceTaskTitle ? (
          <p className="truncate text-xs text-muted">
            Tarefa: {record.practiceTaskTitle}
            {record.practiceSubmissionId ? ' · enviada' : ''}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pausar reprodução' : 'Reproduzir gravação'}
          className={studyRecordingIconButtonClass}
        >
          {isPlaying ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
        </button>
        <div ref={rootRef} className="relative">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Mais opções da gravação"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            className={studyRecordingIconButtonClass}
          >
            <IconMoreVertical className="h-4 w-4" />
          </button>
          {menuPanel ? createPortal(menuPanel, document.body) : null}
        </div>
      </div>
    </li>
  );
}

type RenameRecordingModalProps = {
  record: StudyRecordingRecord | null;
  onClose: () => void;
  onRename: (id: string, title: string) => Promise<string | null>;
};

function RenameRecordingModal({ record, onClose, onRename }: RenameRecordingModalProps) {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!record) {
      return;
    }
    setTitle(record.title);
    setError(null);
    // Seleciona o nome atual para facilitar a troca.
    requestAnimationFrame(() => inputRef.current?.select());
  }, [record]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!record) {
      return;
    }
    if (!title.trim()) {
      setError('Dê um nome à gravação.');
      return;
    }
    setIsSaving(true);
    try {
      await onRename(record.id, title);
      onClose();
    } catch {
      setError('Não foi possível renomear. Tente de novo.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal open={record !== null} onClose={onClose} title="Renomear gravação">
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <input
          ref={inputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={STUDY_RECORDING_TITLE_MAX_LENGTH}
          aria-label="Nome da gravação"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
        />
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

type StudyRecordingListProps = {
  recordings: StudyRecordingRecord[];
  onRemove: (id: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<string | null>;
  emptyMessage?: string;
};

/** Lista de gravações locais com reprodução, renomear, download, compartilhamento e exclusão. */
export function StudyRecordingList({
  recordings,
  onRemove,
  onRename,
  emptyMessage,
}: StudyRecordingListProps) {
  const { isMicrophoneClaimed } = useStudyRecordingSession();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyRecordingRecord | null>(null);
  const [renameTarget, setRenameTarget] = useState<StudyRecordingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => {
    if (isMicrophoneClaimed) {
      stopPlayback();
    }
  }, [isMicrophoneClaimed, stopPlayback]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const togglePlay = useCallback(
    (record: StudyRecordingRecord) => {
      if (playingId === record.id) {
        stopPlayback();
        return;
      }

      stopPlayback();
      const url = URL.createObjectURL(record.blob);
      objectUrlRef.current = url;

      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => stopPlayback();
      audio.onerror = () => stopPlayback();
      void audio.play();
      setPlayingId(record.id);
    },
    [playingId, stopPlayback],
  );

  async function handleShare(record: StudyRecordingRecord) {
    try {
      await shareStudyRecording(record);
    } catch (error) {
      if (!isShareCancellation(error)) {
        downloadStudyRecording(record);
      }
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setIsDeleting(true);
    try {
      if (playingId === deleteTarget.id) {
        stopPlayback();
      }
      await onRemove(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      {recordings.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {recordings.map((record) => (
            <RecordingRow
              key={record.id}
              record={record}
              isPlaying={playingId === record.id}
              onTogglePlay={() => togglePlay(record)}
              onDownload={() => downloadStudyRecording(record)}
              onShare={() => void handleShare(record)}
              onRename={() => setRenameTarget(record)}
              onDelete={() => setDeleteTarget(record)}
              canShare={canShareStudyRecording(record)}
            />
          ))}
        </ul>
      ) : emptyMessage ? (
        <p className="text-sm text-muted">{emptyMessage}</p>
      ) : null}

      <RenameRecordingModal
        record={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={onRename}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Excluir gravação"
        message={
          deleteTarget ? (
            <span>
              Excluir <strong>{deleteTarget.title}</strong>? Esta ação não pode ser desfeita.
            </span>
          ) : (
            ''
          )
        }
        confirmLabel="Excluir"
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
        isConfirming={isDeleting}
      />
    </>
  );
}
