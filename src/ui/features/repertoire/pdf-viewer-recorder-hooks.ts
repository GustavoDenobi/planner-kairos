import { useCallback } from "react";
import { usePdfViewerChrome } from "@/ui/features/repertoire/pdf-viewer-chrome-context";
import {
  useStudyRecordingControlsSurface,
  useStudyRecordingSession,
} from "@/ui/features/study-tools/recording-session/recording-session-context";

export type PdfViewerRecordingContext = {
  organizationId: string;
  pieceId: string;
  pieceFileId: string;
  /** Usado no título das gravações (ex.: nome da obra). */
  titlePrefix?: string | null;
};

/**
 * Registra os controles como visíveis só enquanto a barra do leitor aparece:
 * em tela cheia com a barra escondida, o indicador flutuante global assume.
 */
export function usePdfViewerRecorderSurface(): void {
  const { controlsVisible } = usePdfViewerChrome();
  useStudyRecordingControlsSurface(controlsVisible);
}

/** Inicia a gravação ligada à partitura e à página atual. */
export function usePdfViewerRecorderStart(
  context: PdfViewerRecordingContext,
  userId: string,
  getCurrentPage: () => number,
  /** Gravação feita dentro de uma tarefa (aluno, com a tarefa em foco). */
  practiceTask: { id: string; title: string } | null = null,
) {
  const recording = useStudyRecordingSession();
  return useCallback(() => {
    void recording.start({
      organizationId: context.organizationId,
      userId,
      titlePrefix: context.titlePrefix,
      pieceId: context.pieceId,
      pieceFileId: context.pieceFileId,
      startPage: getCurrentPage(),
      practiceTask,
    });
  }, [context, getCurrentPage, practiceTask, recording, userId]);
}
