import { Modal } from '@/ui/components/Modal';

type LessonDirectedSetPickModalProps = {
  open: boolean;
  options: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSelect: (setId: string) => void;
};

export function LessonDirectedSetPickModal({
  open,
  options,
  onClose,
  onSelect,
}: LessonDirectedSetPickModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Camada desta aula">
      <p className="mb-3 text-sm text-muted">
        Há mais de uma camada sua compatível com esta aula neste arquivo. Qual deseja usar?
      </p>
      <ul className="space-y-1">
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              onClick={() => {
                onSelect(option.id);
                onClose();
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-text hover:bg-bg"
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}