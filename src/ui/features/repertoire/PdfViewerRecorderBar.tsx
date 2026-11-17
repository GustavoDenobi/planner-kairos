import { useState } from "react";
import { ConfirmModal } from "@/ui/components/ConfirmModal";
import { Modal } from "@/ui/components/Modal";
import {
  IconList,
  IconLoader,
  IconPause,
  IconPlay,
  IconRecord,
} from "@/ui/components/icons";
import {
  usePdfViewerRecorderStart,
  usePdfViewerRecorderSurface,
} from "@/ui/features/repertoire/pdf-viewer-recorder-hooks";
import {
  useStudyRecordingElapsedMs,
  useStudyRecordingSession,
} from "@/ui/features/study-tools/recording-session/recording-session-context";
import { StudyRecordingList } from "@/ui/features/study-tools/StudyRecordingList";
import { formatTimerMs } from "@/ui/features/study-tools/study-timer-format";
import { useStudyRecordings } from "@/ui/features/study-tools/useStudyRecordings";

export type { PdfViewerRecordingContext } from "@/ui/features/repertoire/pdf-viewer-recorder-hooks";
import type { PdfViewerRecordingContext } from "@/ui/features/repertoire/pdf-viewer-recorder-hooks";

export const recorderBarButtonClass =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text shadow-sm disabled:opacity-40";

function ElapsedLabel() {
  const elapsedMs = useStudyRecordingElapsedMs();
  return (
    <span className="text-sm font-medium tabular-nums text-text">
      {formatTimerMs(elapsedMs)}
    </span>
  );
}

/** Botão "Gravar" (ou carregando, enquanto o navegador pede o microfone). */
export function PdfViewerRecordButton({
  onStart,
  compactLabel = false,
}: {
  onStart: () => void;
  /** Esconde o texto em telas estreitas. */
  compactLabel?: boolean;
}) {
  const recording = useStudyRecordingSession();
  const isStarting = recording.status === "starting";
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={isStarting}
      aria-label="Iniciar gravação"
      className={recorderBarButtonClass}
    >
      {isStarting ? (
        <IconLoader className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <IconRecord className="h-4 w-4 text-red-600" aria-hidden />
      )}
      <span className={compactLabel ? "hidden sm:inline" : undefined}>
        Gravar
      </span>
    </button>
  );
}

/** Tempo, pausar, cancelar e salvar da gravação em andamento. */
export function PdfViewerRecorderActiveControls() {
  const recording = useStudyRecordingSession();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const isSaving = recording.status === "saving";
  const isPaused = recording.status === "paused";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 shrink-0 rounded-full bg-red-600 ${
          isPaused || isSaving ? "" : "animate-pulse"
        }`}
      />
      {isSaving ? (
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <IconLoader className="h-4 w-4 animate-spin" aria-hidden />
          Salvando…
        </span>
      ) : (
        <ElapsedLabel />
      )}
      <span className="sr-only">
        {isPaused ? "Gravação pausada" : "Gravando"}
      </span>
      <div className="flex items-center gap-1.5">
        {recording.supportsPause ? (
          <button
            type="button"
            onClick={recording.togglePause}
            disabled={isSaving}
            aria-label={isPaused ? "Retomar gravação" : "Pausar gravação"}
            className={`${recorderBarButtonClass} w-8 px-0`}
          >
            {isPaused ? (
              <IconPlay className="h-4 w-4" />
            ) : (
              <IconPause className="h-4 w-4" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setCancelConfirmOpen(true)}
          disabled={isSaving}
          className={recorderBarButtonClass}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void recording.stop()}
          disabled={isSaving}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          Salvar
        </button>
      </div>

      <ConfirmModal
        open={cancelConfirmOpen}
        title="Cancelar gravação"
        message="Descartar esta gravação em andamento? Nada será salvo."
        confirmLabel="Descartar"
        onConfirm={() => {
          recording.cancel();
          setCancelConfirmOpen(false);
        }}
        onClose={() => setCancelConfirmOpen(false)}
      />
    </div>
  );
}

/** Gravações feitas nesta partitura (lista local). */
export function PdfViewerRecordingsModal({
  open,
  onClose,
  context,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  context: PdfViewerRecordingContext;
  userId: string;
}) {
  const { recordings, removeRecording, renameRecording } = useStudyRecordings({
    organizationId: context.organizationId,
    userId,
    pieceFileId: context.pieceFileId,
  });
  return (
    <Modal open={open} onClose={onClose} title="Gravações deste arquivo">
      <StudyRecordingList
        recordings={recordings}
        onRemove={removeRecording}
        onRename={renameRecording}
        emptyMessage="Nenhuma gravação feita nesta partitura ainda."
      />
      <p className="mt-4 text-xs text-muted">
        As gravações ficam salvas só neste aparelho. Todas aparecem também em
        Ferramentas.
      </p>
    </Modal>
  );
}

type PdfViewerRecorderBarProps = {
  context: PdfViewerRecordingContext;
  userId: string;
  getCurrentPage: () => number;
};

/** Barra de gravação do leitor de partituras (dentro da barra de controles). */
export function PdfViewerRecorderBar({
  context,
  userId,
  getCurrentPage,
}: PdfViewerRecorderBarProps) {
  const recording = useStudyRecordingSession();
  const { recordings } = useStudyRecordings({
    organizationId: context.organizationId,
    userId,
    pieceFileId: context.pieceFileId,
  });
  const [listOpen, setListOpen] = useState(false);
  const start = usePdfViewerRecorderStart(context, userId, getCurrentPage);

  usePdfViewerRecorderSurface();

  const isActive = recording.isSessionActive || recording.status === "saving";

  return (
    <div className="flex w-full shrink-0 items-center justify-center gap-2 border-t border-border bg-surface px-3 py-1.5 sm:gap-3">
      {isActive ? (
        <PdfViewerRecorderActiveControls />
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <PdfViewerRecordButton onStart={start} />
          <button
            type="button"
            onClick={() => setListOpen(true)}
            aria-label={`Gravações deste arquivo (${recordings.length})`}
            className={recorderBarButtonClass}
          >
            <IconList className="h-4 w-4" aria-hidden />
            <span className="tabular-nums">{recordings.length}</span>
            <span className="hidden sm:inline">
              {recordings.length === 1 ? "gravação" : "gravações"}
            </span>
          </button>
        </div>
      )}

      <PdfViewerRecordingsModal
        open={listOpen}
        onClose={() => setListOpen(false)}
        context={context}
        userId={userId}
      />
    </div>
  );
}
