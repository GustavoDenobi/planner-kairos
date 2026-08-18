import type {
  CachedPieceFileMeta,
  OfflineFileCache,
} from '@/application/ports/offline-file-cache';
import { getOfflineDb } from './db';

export function createOfflineFileCache(): OfflineFileCache {
  const db = getOfflineDb();

  return {
    async get(pieceFileId: string): Promise<CachedPieceFileMeta | null> {
      const record = await db.cachedFiles.get(pieceFileId);
      if (!record) {
        return null;
      }
      return {
        pieceFileId: record.pieceFileId,
        organizationId: record.organizationId,
        pieceId: record.pieceId,
        contentHash: record.contentHash,
        byteSize: record.byteSize,
        title: record.title,
        cachedAt: record.cachedAt,
      };
    },

    async getBlob(pieceFileId: string): Promise<Blob | null> {
      const record = await db.cachedFiles.get(pieceFileId);
      return record?.blob ?? null;
    },

    async put(entry: CachedPieceFileMeta & { blob: Blob }): Promise<void> {
      await db.cachedFiles.put({
        pieceFileId: entry.pieceFileId,
        organizationId: entry.organizationId,
        pieceId: entry.pieceId,
        contentHash: entry.contentHash,
        byteSize: entry.byteSize,
        title: entry.title,
        cachedAt: entry.cachedAt,
        blob: entry.blob,
      });
    },

    async remove(pieceFileId: string): Promise<void> {
      await db.cachedFiles.delete(pieceFileId);
    },

    async listForOrganization(organizationId: string): Promise<CachedPieceFileMeta[]> {
      const records = await db.cachedFiles.where('organizationId').equals(organizationId).toArray();
      return records.map((record) => ({
        pieceFileId: record.pieceFileId,
        organizationId: record.organizationId,
        pieceId: record.pieceId,
        contentHash: record.contentHash,
        byteSize: record.byteSize,
        title: record.title,
        cachedAt: record.cachedAt,
      }));
    },

    async isStale(pieceFileId: string, contentHash: string | null): Promise<boolean> {
      const record = await db.cachedFiles.get(pieceFileId);
      if (!record) {
        return false;
      }
      if (!contentHash) {
        return false;
      }
      return record.contentHash !== contentHash;
    },

    async clearAll(): Promise<void> {
      await db.cachedFiles.clear();
    },
  };
}
