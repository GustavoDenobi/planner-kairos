import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ReadingPlaylist, ReadingPlaylistDetail } from '@/domain/repertoire';
import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';
import { useOffline, useRepertoire } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { IconPencil, IconPlus, IconScoreSheet } from '@/ui/components/icons';
import { PlaylistListRowsSkeleton } from '@/ui/components/skeletons/page-list-skeletons';
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
  const [archivedPlaylists, setArchivedPlaylists] = useState<ReadingPlaylist[]>([]);
  const [showArchived, setShowArchived] = useState(false);
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
          sourceEventAudience: detail.sourceEventAudience ?? null,
          archivedAt: detail.archivedAt,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        });
        counts[detail.id] = detail.items.filter(isPlaylistItemAvailable).length;
        cachedIds.add(detail.id);
      }

      setPlaylists(offlinePlaylists);
      setArchivedPlaylists([]);
      setItemCounts(counts);
      setCachedPlaylistIds(cachedIds);
      setIsOfflineList(true);
      setIsLoading(false);
      return;
    }

    const [result, archivedResult] = await Promise.all([
      repertoire.listReadingPlaylists(org.id, userId),
      repertoire.listArchivedReadingPlaylists(org.id, userId),
    ]);
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
            sourceEventAudience: detail.sourceEventAudience ?? null,
            archivedAt: detail.archivedAt,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
          });
          counts[detail.id] = detail.items.filter(isPlaylistItemAvailable).length;
          cachedIds.add(detail.id);
        }

        setPlaylists(offlinePlaylists);
        setArchivedPlaylists([]);
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
    setArchivedPlaylists(archivedResult.ok ? archivedResult.value : []);

    const counts: Record<string, number> = {};
    const allListed = [
      ...result.value,
      ...(archivedResult.ok ? archivedResult.value : []),
    ];
    for (const playlist of allListed) {
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

  const orgSlugResolved = orgSlug;
  const showOfflineUi = isOfflineList || !online;

  function renderPlaylistRow(playlist: ReadingPlaylist, archived: boolean) {
    return (
      <li
        key={playlist.id}
        className={`flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3 ${
          archived ? 'bg-bg' : 'bg-surface'
        }`}
      >
        <div className="min-w-0 flex-1">
          {showOfflineUi ? (
            <span className={`font-medium ${archived ? 'text-muted' : 'text-text'}`}>
              {playlist.name}
            </span>
          ) : (
            <Link
              to={readingPlaylistEditPath(orgSlugResolved, playlist.id)}
              className={`font-medium hover:underline ${archived ? 'text-muted' : 'text-text'}`}
            >
              {playlist.name}
            </Link>
          )}
          <p className="mt-0.5 text-sm text-muted">
            {itemCounts[playlist.id] ?? 0}{' '}
            {(itemCounts[playlist.id] ?? 0) === 1 ? 'partitura' : 'partituras'}
            {playlist.sourceEventKind && ` · ${eventKindLabel(playlist.sourceEventKind)}`}
            {archived && playlist.archivedAt && (
              <>
                {' '}
                · Arquivada em{' '}
                {new Date(playlist.archivedAt).toLocaleDateString('pt-BR')}
              </>
            )}
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
                navigate(readingPlaylistReaderPath(orgSlugResolved, playlist.id, 0), {
                  state: { returnTo: locationPath(location) },
                })
              }
              aria-label="Abrir leitor"
              className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-primary hover:bg-bg"
            >
              <IconScoreSheet className="h-4 w-4" />
            </button>
          )}
          {!showOfflineUi && (
            <button
              type="button"
              onClick={() => navigate(readingPlaylistEditPath(orgSlugResolved, playlist.id))}
              aria-label={`Editar ${playlist.name}`}
              className="rounded-lg border border-border p-2 text-muted hover:bg-bg hover:text-text"
            >
              <IconPencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </li>
    );
  }

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
          <PlaylistListRowsSkeleton />
        ) : playlists.length === 0 && archivedPlaylists.length === 0 ? (
          <p className="text-center text-sm text-muted">
            {showOfflineUi
              ? 'Nenhuma playlist salva neste dispositivo. Com conexão, as partituras das playlists são salvas automaticamente.'
              : 'Nenhuma playlist até agora.'}
          </p>
        ) : (
          <div className="space-y-2">
            {playlists.length > 0 && (
              <ul className="space-y-2">
                {playlists.map((playlist) => renderPlaylistRow(playlist, false))}
              </ul>
            )}
            {playlists.length === 0 && archivedPlaylists.length > 0 && !showArchived && (
              <p className="text-center text-sm text-muted">Nenhuma playlist ativa.</p>
            )}
            {!showOfflineUi && archivedPlaylists.length > 0 && !showArchived && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowArchived(true)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Ver arquivadas
                </button>
              </div>
            )}
            {showArchived && archivedPlaylists.length > 0 && (
              <ul className="space-y-2">
                {archivedPlaylists.map((playlist) => renderPlaylistRow(playlist, true))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
