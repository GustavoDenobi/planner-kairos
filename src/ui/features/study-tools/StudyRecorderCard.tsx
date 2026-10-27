import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StudyRecordingRecord } from '@/infrastructure/pwa/db';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { computeFloatingPanelPosition } from '@/ui/features/repertoire/floating-panel-position';
import {
  IconDownload,
  IconMic,
  IconMoreVertical,
  IconPause,
  IconPlay,
  IconRecord,
  IconShare,
  IconTrash,
} from '@/ui/components/icons';
import { formatTimerMs } from '@/ui/features/study-tools/study-timer-format';
import {
  canShareStudyRecording,
  downloadStudyRecording,
  isShareCancellation,
  shareStudyRecording,
} from '@/ui/features/study-tools/study-recording-delivery';
import { studyRecordingFileExtension } from '@/ui/features/study-tools/study-recording-format';
import { useStudyRecorder } from '@/ui/features/study-tools/useStudyRecorder';

type StudyRecorderCardProps = {
  organizationId: string | null;
  userId: string | null;
  onBeforeStart?: () => void;
  onSessionActiveChange?: (active: boolean) => void;
};

const iconButtonClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text disabled:opacity-40';

const contextMenuItemClass =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-bg';

type RecordingRowProps = {
  record: StudyRecordingRecord;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onDownload: () => void;
  onShare: () => void;
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
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pausar reprodução' : 'Reproduzir gravação'}
          className={iconButtonClass}
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
            className={iconButtonClass}
          >
            <IconMoreVertical className="h-4 w-4" />
          </button>
          {menuPanel ? createPortal(menuPanel, document.body) : null}
        </div>
      </div>
    </li>
  );
}

export function StudyRecorderCard({
  organizationId,
  userId,
  onBeforeStart,
  onSessionActiveChange,
}: StudyRecorderCardProps) {
  const recorder = useStudyRecorder({
    organizationId,
    userId,
    onBeforeStart,
    onSessionActiveChange,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyRecordingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

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
    if (recorder.isSessionActive) {
      stopPlayback();
    }
  }, [recorder.isSessionActive, stopPlayback]);

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
      await recorder.removeRecording(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  const isIdle = recorder.status === 'idle';

  return (
    <section
      aria-labelledby="study-recorder-heading"
      className="flex flex-col rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2
            id="study-recorder-heading"
            className="flex items-center gap-2 text-base font-semibold text-text"
          >
            <IconMic className="h-5 w-5 shrink-0" aria-hidden />
            Gravador
          </h2>
        </div>
        {!isIdle ? (
          <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-medium tabular-nums text-primary">
            {formatTimerMs(recorder.elapsedMs)}
          </span>
        ) : null}
      </div>

      {recorder.error ? <p className="mt-3 text-sm text-muted">{recorder.error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {isIdle ? (
          <button
            type="button"
            onClick={() => void recorder.startRecording()}
            aria-label="Iniciar gravação"
            className={`${iconButtonClass} h-9 w-auto gap-2 px-3`}
          >
            <IconRecord className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
            Gravar
          </button>
        ) : (
          <>
            {recorder.supportsPause ? (
              <button
                type="button"
                onClick={recorder.togglePause}
                aria-label={recorder.status === 'paused' ? 'Retomar gravação' : 'Pausar gravação'}
                className={iconButtonClass}
              >
                {recorder.status === 'paused' ? (
                  <IconPlay className="h-4 w-4" />
                ) : (
                  <IconPause className="h-4 w-4" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setCancelConfirmOpen(true)}
              aria-label="Cancelar gravação"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={recorder.stopRecording}
              aria-label="Encerrar e salvar gravação"
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-white hover:opacity-90"
            >
              Salvar
            </button>
          </>
        )}
      </div>

      {recorder.recordings.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-medium text-text">Gravações salvas</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {recorder.recordings.map((record) => (
              <RecordingRow
                key={record.id}
                record={record}
                isPlaying={playingId === record.id}
                onTogglePlay={() => togglePlay(record)}
                onDownload={() => downloadStudyRecording(record)}
                onShare={() => void handleShare(record)}
                onDelete={() => setDeleteTarget(record)}
                canShare={canShareStudyRecording(record)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmModal
        open={cancelConfirmOpen}
        title="Cancelar gravação"
        message="Descartar esta gravação em andamento? Nada será salvo."
        confirmLabel="Descartar"
        onConfirm={() => {
          recorder.cancelRecording();
          setCancelConfirmOpen(false);
        }}
        onClose={() => setCancelConfirmOpen(false)}
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
    </section>
  );
}
