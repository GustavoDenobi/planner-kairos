import type { OfflineOrgImageCache } from '@/application/ports/offline-org-image-cache';
import { getOfflineDb } from './db';

export function createOfflineOrgImageCache(): OfflineOrgImageCache {
  const db = getOfflineDb();

  return {
    async getBlob(storageKey) {
      const record = await db.cachedOrgImages.get(storageKey);
      return record?.blob ?? null;
    },

    async put(entry) {
      await db.cachedOrgImages.put({
        storageKey: entry.storageKey,
        cachedAt: entry.cachedAt,
        blob: entry.blob,
      });
    },

    async remove(storageKey) {
      await db.cachedOrgImages.delete(storageKey);
    },

    async clearAll() {
      await db.cachedOrgImages.clear();
    },
  };
}
