import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ReadingPlaylist } from '@/domain/repertoire';
import { useRepertoire } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { IconPencil, IconPlay, IconPlus } from '@/ui/components/icons';
import { readingPlaylistErrorMessage } from '@/ui/features/repertoire/reading-playlist-labels';
import { eventKindLabel } from '@/ui/features/agenda/agenda-labels';
import {
  readingPlaylistEditPath,
  readingPlaylistNewPath,
  readingPlaylistReaderPath,
} from '@/ui/features/repertoire/reading-playlist-routes';
import { orgListPageHeightClass } from '@/ui/layouts/OrgListPageLayout';

export function ReadingPlaylistsPage() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const repertoire = useRepertoire();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((item) => item.slug === orgSlug);

  const [playlists, setPlaylists] = useState<ReadingPlaylist[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlaylists = useCallback(async () => {
    if (!org || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await repertoire.listReadingPlaylists(org.id, userId);
    if (!result.ok) {
      setError(readingPlaylistErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    setPlaylists(result.value);

    const counts: Record<string, number> = {};
    for (const playlist of result.value) {
      const detailResult = await repertoire.getReadingPlaylist(org.id, playlist.id, userId);
      if (detailResult.ok) {
        counts[playlist.id] = detailResult.value.items.length;
      }
    }
    setItemCounts(counts);
    setIsLoading(false);
  }, [org, userId, repertoire]);

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  if (!orgSlug) {
    return null;
  }

  return (
    <div className={`${orgListPageHeightClass} flex flex-col`}>
      <div className="shrink-0 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">Playlist</h1>
        <button
          type="button"
          onClick={() => navigate(readingPlaylistNewPath(orgSlug))}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
        >
          <IconPlus className="h-4 w-4" />
          Playlist
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto mt-4">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : playlists.length === 0 ? (
          <p className="text-center text-sm text-muted">
            Nenhuma playlist até agora.
          </p>
        ) : (
          <ul className="space-y-2">
            {playlists.map((playlist) => (
              <li
                key={playlist.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={readingPlaylistEditPath(orgSlug, playlist.id)}
                    className="font-medium text-text hover:underline"
                  >
                    {playlist.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-muted">
                    {itemCounts[playlist.id] ?? 0}{' '}
                    {(itemCounts[playlist.id] ?? 0) === 1 ? 'partitura' : 'partituras'}
                    {playlist.sourceEventKind && ` · ${eventKindLabel(playlist.sourceEventKind)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(itemCounts[playlist.id] ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(readingPlaylistReaderPath(orgSlug, playlist.id, 0))
                      }
                      aria-label="Abrir leitor"
                      className="rounded-lg border border-border p-2 text-primary hover:bg-bg"
                    >
                      <IconPlay className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      navigate(readingPlaylistEditPath(orgSlug, playlist.id))
                    }
                    aria-label={`Editar ${playlist.name}`}
                    className="rounded-lg border border-border p-2 text-muted hover:bg-bg hover:text-text"
                  >
                    <IconPencil className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
