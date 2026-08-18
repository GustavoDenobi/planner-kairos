import { useState } from 'react';

type PieceAliasesFieldProps = {
  value: string[];
  onChange: (aliases: string[]) => void;
};

export function PieceAliasesField({ value, onChange }: PieceAliasesFieldProps) {
  const [draft, setDraft] = useState('');

  function addAlias() {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    const exists = value.some((alias) => alias.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      onChange([...value, trimmed]);
    }
    setDraft('');
  }

  function removeAlias(index: number) {
    onChange(value.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addAlias();
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-text">Apelidos</span>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar apelido…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addAlias}
          disabled={!draft.trim()}
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((alias, index) => (
            <span
              key={`${alias}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted"
            >
              {alias}
              <button
                type="button"
                onClick={() => removeAlias(index)}
                className="rounded-full px-1 text-muted hover:text-text"
                aria-label={`Remover apelido ${alias}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
