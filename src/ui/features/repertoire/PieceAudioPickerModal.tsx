import type { PieceFileWithLinks } from '@/domain/repertoire';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { Modal } from '@/ui/components/Modal';
import { formatPartLinks } from '@/ui/features/repertoire/repertoire-labels';

type PieceAudioPickerModalProps = {
  open: boolean;
  onClose: () => void;
  files: PieceFileWithLinks[];
  parts: PartWithDivisions[];
  onSelect: (file: PieceFileWithLinks) => void;
};

export function PieceAudioPickerModal({
  open,
  onClose,
  files,
  parts,
  onSelect,
}: PieceAudioPickerModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Áudios da peça">
      {files.length === 0 ? (
        <p className="text-sm text-muted">Nenhum áudio disponível.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(file);
                  onClose();
                }}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-left hover:bg-bg"
              >
                <p className="font-medium text-text">{file.title}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {file.partLinks.length > 0
                    ? formatPartLinks(file.partLinks, parts)
                    : 'Áudio geral'}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
