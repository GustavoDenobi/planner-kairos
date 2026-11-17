import { useCallback, useMemo, useRef, useState } from 'react';
import type { PdfViewerRecordingContext } from '@/ui/features/repertoire/PdfViewerRecorderBar';
import {
  ReaderPracticeTaskBar,
  ReaderPracticeTasksButton,
} from '@/ui/features/practice/ReaderPracticeTasks';
import { useReaderPracticeTasks } from '@/ui/features/practice/useReaderPracticeTasks';
import { PracticeTaskForm } from '@/ui/features/practice/PracticeTaskForm';
import { Modal } from '@/ui/components/Modal';

type UseReaderPracticeTaskUiOptions = {
  orgSlug: string | undefined;
  organizationId: string | null;
  userId: string | null;
  pieceId: string | null;
  pieceFileId: string | null;
  initialTaskId: string | null;
  online: boolean;
  /** Mesmo contexto do gravador do leitor: com tarefa em foco, ele vai para a faixa. */
  recordingContext: PdfViewerRecordingContext | null;
};

/**
 * Tarefas no leitor de partituras: botão na barra (tarefas desta partitura),
 * faixa da tarefa em foco e pedidos de navegação até o trecho.
 */
export function useReaderPracticeTaskUi({
  orgSlug,
  organizationId,
  userId,
  pieceId,
  pieceFileId,
  initialTaskId,
  online,
  recordingContext,
}: UseReaderPracticeTaskUiOptions) {
  const tasks = useReaderPracticeTasks({
    organizationId,
    userId,
    pieceFileId,
    initialTaskId,
    online,
  });
  const [pageRequest, setPageRequest] = useState<{ page: number; nonce: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  currentPageRef.current = currentPage;
  const getCurrentPage = useCallback(() => currentPageRef.current, []);

  const goToPage = useCallback((page: number) => {
    setPageRequest((current) => ({ page, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);

  const { options, listStatus, canCreate, activeTaskId, activeDetail, setActiveTaskId, refresh } =
    tasks;
  /** Página em que o formulário foi aberto (a tarefa nova aponta para ela). */
  const [newTaskPage, setNewTaskPage] = useState<number | null>(null);

  const selectTask = useCallback(
    (taskId: string) => {
      setActiveTaskId(taskId);
      const option = options.find((item) => item.taskId === taskId);
      if (option?.startPage) {
        goToPage(option.startPage);
      }
    },
    [goToPage, options, setActiveTaskId],
  );

  const canRender = Boolean(orgSlug && organizationId && userId && pieceFileId);

  const newTaskPrefill = useMemo(
    () =>
      pieceId && pieceFileId && newTaskPage
        ? { pieceId, fileId: pieceFileId, page: newTaskPage }
        : undefined,
    [newTaskPage, pieceFileId, pieceId],
  );

  const toolbarExtraActions = canRender ? (
    <>
      <ReaderPracticeTasksButton
        options={options}
        listStatus={listStatus}
        canCreate={canCreate && Boolean(pieceId)}
        activeTaskId={activeTaskId}
        currentPage={currentPage}
        onSelect={selectTask}
        onRetry={refresh}
        onNewTask={() => setNewTaskPage(currentPage)}
      />
      {/* Criada no próprio leitor: a partitura continua aberta na mesma página. */}
      {organizationId && userId && newTaskPrefill ? (
        <Modal open onClose={() => setNewTaskPage(null)} title="Nova tarefa" size="lg">
          <PracticeTaskForm
            organizationId={organizationId}
            userId={userId}
            prefill={newTaskPrefill}
            onSaved={(task) => {
              setNewTaskPage(null);
              setActiveTaskId(task.id);
              refresh();
            }}
            onCancel={() => setNewTaskPage(null)}
          />
        </Modal>
      ) : null}
    </>
  ) : null;

  const controlsBarExtra =
    canRender && activeDetail && orgSlug && organizationId && userId && pieceFileId ? (
      <ReaderPracticeTaskBar
        orgSlug={orgSlug}
        organizationId={organizationId}
        userId={userId}
        pieceFileId={pieceFileId}
        detail={activeDetail}
        recordingContext={recordingContext}
        getCurrentPage={getCurrentPage}
        onGoToPage={goToPage}
        onClose={() => setActiveTaskId(null)}
        onSubmitted={refresh}
      />
    ) : null;

  /** Passe para o PdfViewer: a lista de tarefas usa o trecho em que o leitor está. */
  const onPageChange = setCurrentPage;

  /** Com a faixa da tarefa aberta, os controles de gravação ficam nela. */
  const recorderEmbedded = controlsBarExtra !== null && recordingContext !== null;

  return { toolbarExtraActions, controlsBarExtra, pageRequest, onPageChange, recorderEmbedded };
}
