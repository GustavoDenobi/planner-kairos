import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ReadingPlaylist, ReadingPlaylistDetail } from '@/domain/repertoire';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import { useOffline, useRepertoire } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { IconPencil, IconPlay, IconPlus } from '@/ui/components/icons';
import { readingPlaylistErrorMessage } from '@/ui/features/repertoire/reading-playlist-labels';
import { eventKindLabel } from '@/ui/features/agenda/agenda-labels';
import {
  readingPlaylistEditPath,
  readingPlaylistNewPath,
  readingPlaylistReaderPath,
} from '@/ui/features/repertoire/reading-playlist-routes';
import { locationPath } from '@/ui/navigation/return-to';
import {
  orgListPageHeightClass,
  orgPageContentClass,
} from '@/ui/layouts/OrgListPageLayout';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

function isPlaylistItemAvailable(item: ReadingPlaylistDetail['items'][number]): boolean {
  return Boolean(item.pieceId) && !item.pieceDeleted;
}

export function ReadingPlaylistsPage() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const repertoire = useRepertoire();
  const offline = useOffline();
  const { userId } = useAuth();
  const { resolveOrgBySlug } = useOrg();
  const online = useOnlineStatus();
  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;

  const [playlists, setPlaylists] = useState<ReadingPlaylist[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [cachedPlaylistIds, setCachedPlaylistIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('reading-playlists', isLoading);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineList, setIsOfflineList] = useState(false);

  const loadPlaylists = useCallback(async () => {
    if (!org || !userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    if (!isBrowserOnline()) {
      const cached = await offline.listCachedPlaylistsForOrganization(org.id);
      const offlinePlaylists: ReadingPlaylist[] = [];
      const counts: Record<string, number> = {};
      const cachedIds = new Set<string>();

      for (const snapshot of cached) {
        const detail = JSON.parse(snapshot.snapshotJson) as ReadingPlaylistDetail;
        offlinePlaylists.push({
          id: detail.id,
          organizationId: detail.organizationId,
          ownerUserId: detail.ownerUserId,
          name: detail.name,
          sourceEventId: detail.sourceEventId,
          sourceEventKind: detail.sourceEventKind,
          archivedAt: detail.archivedAt,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        });
        counts[detail.id] = detail.items.filter(isPlaylistItemAvailable).length;
        cachedIds.add(detail.id);
      }

      setPlaylists(offlinePlaylists);
      setItemCounts(counts);
      setCachedPlaylistIds(cachedIds);
      setIsOfflineList(true);
      setIsLoading(false);
      return;
    }

    const result = await repertoire.listReadingPlaylists(org.id, userId);
    if (!result.ok) {
      const cached = await offline.listCachedPlaylistsForOrganization(org.id);
      if (cached.length > 0) {
        const offlinePlaylists: ReadingPlaylist[] = [];
        const counts: Record<string, number> = {};
        const cachedIds = new Set<string>();

        for (const snapshot of cached) {
          const detail = JSON.parse(snapshot.snapshotJson) as ReadingPlaylistDetail;
          offlinePlaylists.push({
            id: detail.id,
            organizationId: detail.organizationId,
            ownerUserId: detail.ownerUserId,
            name: detail.name,
            sourceEventId: detail.sourceEventId,
            sourceEventKind: detail.sourceEventKind,
            archivedAt: detail.archivedAt,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
          });
          counts[detail.id] = detail.items.filter(isPlaylistItemAvailable).length;
          cachedIds.add(detail.id);
        }

        setPlaylists(offlinePlaylists);
        setItemCounts(counts);
        setCachedPlaylistIds(cachedIds);
        setIsOfflineList(true);
        setIsLoading(false);
        return;
      }

      setError(readingPlaylistErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    setIsOfflineList(false);
    setPlaylists(result.value);

    const counts: Record<string, number> = {};
    for (const playlist of result.value) {
      const detailResult = await repertoire.getReadingPlaylist(org.id, playlist.id, userId);
      if (detailResult.ok) {
        counts[playlist.id] = detailResult.value.items.length;
      }
    }

    const cached = await offline.listCachedPlaylistsForOrganization(org.id);
    setCachedPlaylistIds(new Set(cached.map((item) => item.playlistId)));
    setItemCounts(counts);
    setIsLoading(false);

    void offline.cacheUserReadingPlaylistsForOffline(org.id, userId).then(async () => {
      const refreshed = await offline.listCachedPlaylistsForOrganization(org.id);
      setCachedPlaylistIds(new Set(refreshed.map((item) => item.playlistId)));
    });
  }, [org, userId, repertoire, offline]);

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  if (!orgSlug) {
    return null;
  }

  const showOfflineUi = isOfflineList || !online;

  return (
    <div className={`flex flex-col ${orgPageContentClass} ${orgListPageHeightClass}`}>
      <div className="shrink-0 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text">Playlist</h1>
        {!showOfflineUi && (
          <button
            type="button"
            onClick={() => navigate(readingPlaylistNewPath(orgSlug))}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <IconPlus className="h-4 w-4" />
            Playlist
          </button>
        )}
      </div>

      {showOfflineUi && (
        <p className="mt-2 text-sm text-muted">
          Mostrando playlists salvas neste dispositivo.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto mt-4">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {isLoading ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : playlists.length === 0 ? (
          <p className="text-center text-sm text-muted">
            {showOfflineUi
              ? 'Nenhuma playlist salva neste dispositivo. Com conexão, as partituras das playlists são salvas automaticamente.'
              : 'Nenhuma playlist até agora.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {playlists.map((playlist) => (
              <li
                key={playlist.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  {showOfflineUi ? (
                    <span className="font-medium text-text">{playlist.name}</span>
                  ) : (
                    <Link
                      to={readingPlaylistEditPath(orgSlug, playlist.id)}
                      className="font-medium text-text hover:underline"
                    >
                      {playlist.name}
                    </Link>
                  )}
                  <p className="mt-0.5 text-sm text-muted">
                    {itemCounts[playlist.id] ?? 0}{' '}
                    {(itemCounts[playlist.id] ?? 0) === 1 ? 'partitura' : 'partituras'}
                    {playlist.sourceEventKind && ` · ${eventKindLabel(playlist.sourceEventKind)}`}
                    {cachedPlaylistIds.has(playlist.id) && (
                      <span className="ml-1 text-primary">· Disponível offline</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(itemCounts[playlist.id] ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(readingPlaylistReaderPath(orgSlug, playlist.id, 0), {
                          state: { returnTo: locationPath(location) },
                        })
                      }
                      aria-label="Abrir leitor"
                      className="rounded-lg border border-border p-2 text-primary hover:bg-bg"
                    >
                      <IconPlay className="h-4 w-4" />
                    </button>
                  )}
                  {!showOfflineUi && (
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
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
