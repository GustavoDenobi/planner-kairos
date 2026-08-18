import type {
  CachedPlaylistSnapshot,
  OfflinePlaylistCache,
} from '@/application/ports/offline-playlist-cache';
import { getOfflineDb } from './db';

export function createOfflinePlaylistCache(): OfflinePlaylistCache {
  const db = getOfflineDb();

  return {
    async get(playlistId: string): Promise<CachedPlaylistSnapshot | null> {
      const record = await db.cachedPlaylists.get(playlistId);
      if (!record) {
        return null;
      }
      return {
        playlistId: record.playlistId,
        organizationId: record.organizationId,
        ownerUserId: record.ownerUserId,
        name: record.name,
        pieceFileIds: record.pieceFileIds,
        snapshotJson: record.snapshotJson,
        cachedAt: record.cachedAt,
      };
    },

    async put(snapshot: CachedPlaylistSnapshot): Promise<void> {
      await db.cachedPlaylists.put({
        playlistId: snapshot.playlistId,
        organizationId: snapshot.organizationId,
        ownerUserId: snapshot.ownerUserId,
        name: snapshot.name,
        pieceFileIds: snapshot.pieceFileIds,
        snapshotJson: snapshot.snapshotJson,
        cachedAt: snapshot.cachedAt,
      });
    },

    async remove(playlistId: string): Promise<void> {
      await db.cachedPlaylists.delete(playlistId);
    },

    async listForOrganization(organizationId: string): Promise<CachedPlaylistSnapshot[]> {
      const records = await db.cachedPlaylists
        .where('organizationId')
        .equals(organizationId)
        .toArray();
      return records.map((record) => ({
        playlistId: record.playlistId,
        organizationId: record.organizationId,
        ownerUserId: record.ownerUserId,
        name: record.name,
        pieceFileIds: record.pieceFileIds,
        snapshotJson: record.snapshotJson,
        cachedAt: record.cachedAt,
      }));
    },

    async clearAll(): Promise<void> {
      await db.cachedPlaylists.clear();
    },
  };
}
