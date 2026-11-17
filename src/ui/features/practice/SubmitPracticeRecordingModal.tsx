import type { PracticeSubmission, PracticeTask } from '@/domain/practice';
import { Modal } from '@/ui/components/Modal';
import {
  PracticeTakeSender,
  usePracticeTaskTakes,
} from '@/ui/features/practice/PracticeTaskAttempt';

type SubmitPracticeRecordingModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  userId: string;
  task: PracticeTask;
  onSubmitted: (submission: PracticeSubmission) => void;
};

/** Envio no leitor: só as gravações feitas com esta tarefa em foco. */
export function SubmitPracticeRecordingModal({
  open,
  onClose,
  organizationId,
  userId,
  task,
  onSubmitted,
}: SubmitPracticeRecordingModalProps) {
  const { takes, isLoading, removeTake } = usePracticeTaskTakes(organizationId, userId, task);

  return (
    <Modal open={open} onClose={onClose} title="Enviar para a tarefa">
      {isLoading && takes.length === 0 ? (
        <p className="text-sm text-muted">Carregando gravações…</p>
      ) : takes.length === 0 ? (
        <div className="space-y-3 text-sm text-muted">
          <p>Nenhuma gravação desta tarefa ainda.</p>
          <p>
            Use o botão <strong className="text-text">Gravar</strong> desta faixa. Só gravações
            feitas com a tarefa aberta podem ser enviadas.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex rounded-lg bg-primary px-3 py-2 font-medium text-white"
          >
            Entendi
          </button>
        </div>
      ) : (
        <PracticeTakeSender
          organizationId={organizationId}
          userId={userId}
          task={task}
          takes={takes}
          onRemoveTake={removeTake}
          onSubmitted={(submission) => {
            onSubmitted(submission);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
