import type { ReadingPlaylist } from '@/domain/repertoire';
import { Modal } from '@/ui/components/Modal';
import { IconChevronRight, IconPlus } from '@/ui/components/icons';

type EventReadingPlaylistPickerModalProps = {
  open: boolean;
  onClose: () => void;
  playlists: ReadingPlaylist[];
  onSelectPlaylist: (playlistId: string) => void;
  onCreateNew: () => void;
};

export function EventReadingPlaylistPickerModal({
  open,
  onClose,
  playlists,
  onSelectPlaylist,
  onCreateNew,
}: EventReadingPlaylistPickerModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Playlists deste evento">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Você já tem {playlists.length === 1 ? 'uma playlist' : 'playlists'} para este evento.
          Abra uma existente ou crie uma nova.
        </p>

        <ul className="space-y-2">
          {playlists.map((playlist) => (
            <li key={playlist.id}>
              <button
                type="button"
                onClick={() => onSelectPlaylist(playlist.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-bg px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-surface"
              >
                <span className="min-w-0 truncate font-medium text-text">{playlist.name}</span>
                <IconChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" />
          Criar nova playlist
        </button>
      </div>
    </Modal>
  );
}
