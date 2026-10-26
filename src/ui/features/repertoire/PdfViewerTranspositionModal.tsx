import {
  clampPartTransposeSemitones,
  formatTransposeKeyWithSemitones,
  MAX_PART_TRANSPOSE_SEMITONES,
  MIN_PART_TRANSPOSE_SEMITONES,
} from '@/domain/ensemble';
import { Modal } from '@/ui/components/Modal';

export type PdfViewerTransposePartOption = {
  id: string;
  name: string;
  defaultTransposeSemitones: number;
};

type PdfViewerTranspositionModalProps = {
  open: boolean;
  onClose: () => void;
  partOptions: PdfViewerTransposePartOption[];
  semitones: number;
  selectedPartId: string | null;
  onSemitonesChange: (semitones: number) => void;
  onPartPresetChange: (partId: string | null) => void;
};

export function PdfViewerTranspositionModal({
  open,
  onClose,
  partOptions,
  semitones,
  selectedPartId,
  onSemitonesChange,
  onPartPresetChange,
}: PdfViewerTranspositionModalProps) {
  const clamped = clampPartTransposeSemitones(semitones);

  return (
    <Modal open={open} onClose={onClose} title="Transpor" size="md">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted">
          Ajuste o que o afinador mostra em relação ao som captado.
        </p>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text">Transposição</span>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onSemitonesChange(clamped - 1)}
              disabled={clamped <= MIN_PART_TRANSPOSE_SEMITONES}
              aria-label="Diminuir transposição em um semitom"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-lg text-text disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-28 text-center text-lg font-medium tabular-nums text-text">
              {formatTransposeKeyWithSemitones(clamped)}
            </span>
            <button
              type="button"
              onClick={() => onSemitonesChange(clamped + 1)}
              disabled={clamped >= MAX_PART_TRANSPOSE_SEMITONES}
              aria-label="Aumentar transposição em um semitom"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-lg text-text disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        {partOptions.length > 0 ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text">Preset da parte</span>
            <select
              value={selectedPartId ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                onPartPresetChange(value === '' ? null : value);
              }}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
            >
              <option value="">Concerto (sem preset)</option>
              {partOptions.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.name} — {formatTransposeKeyWithSemitones(part.defaultTransposeSemitones)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Concluir
        </button>
      </div>
    </Modal>
  );
}
