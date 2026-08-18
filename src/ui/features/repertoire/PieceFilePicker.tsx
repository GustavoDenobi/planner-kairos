import { useRef } from 'react';
import { IconUpload } from '@/ui/components/icons';

type PieceFilePickerProps = {
  accept: string;
  disabled?: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
};

export function PieceFilePicker({ accept, disabled, file, onFileChange }: PieceFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onFileChange(event.target.files?.[0] ?? null);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={handleChange}
      />
      {file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text hover:bg-bg disabled:opacity-60"
        >
          Alterar arquivo
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          <IconUpload className="h-4 w-4" />
          Selecionar Arquivo
        </button>
      )}
      {file && (
        <p className="text-sm text-text" title={file.name}>
          {file.name}
        </p>
      )}
    </div>
  );
}
