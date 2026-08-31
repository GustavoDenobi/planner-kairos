import { useEffect, useState } from 'react';
import type { PieceListItem } from '@/domain/repertoire';
import { Modal } from '@/ui/components/Modal';

type EventProgramPiecePickerProps = {
  open: boolean;
  onClose: () => void;
  pieces: PieceListItem[];
  onSearch: (query: string) => void;
  isSearching: boolean;
  onSelect: (pieceId: string) => void;
};

export function EventProgramPiecePicker({
  open,
  onClose,
  pieces,
  onSearch,
  isSearching,
  onSelect,
}: EventProgramPiecePickerProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timeout = window.setTimeout(() => {
      onSearch(query);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [open, query, onSearch]);

  return (
    <Modal open={open} onClose={onClose} title="Selecionar peça">
      <div className="space-y-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Título, compositor ou apelido"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          autoFocus
        />

        {isSearching ? (
          <p className="text-sm text-muted">Buscando…</p>
        ) : pieces.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma obra disponível.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {pieces.map((piece) => (
              <li key={piece.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(piece.id);
                    onClose();
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-bg"
                >
                  <span className="font-medium text-text">{piece.title}</span>
                  {piece.composer && (
                    <span className="ml-2 text-muted">{piece.composer}</span>
                  )}
                  {piece.aliases.length > 0 && (
                    <span className="mt-0.5 block text-xs text-muted">
                      {piece.aliases.join(' · ')}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
