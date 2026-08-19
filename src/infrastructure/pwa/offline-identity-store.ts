import type {
  IdentitySnapshot,
  OfflineIdentityStore,
} from '@/application/ports/offline-identity-store';
import { getOfflineDb } from './db';

export function createOfflineIdentityStore(): OfflineIdentityStore {
  const db = getOfflineDb();

  return {
    async get(): Promise<IdentitySnapshot | null> {
      const record = await db.identitySnapshot.get('current');
      if (!record) {
        return null;
      }
      return {
        userId: record.userId,
        email: record.email,
        organizations: JSON.parse(record.organizationsJson) as IdentitySnapshot['organizations'],
        currentOrgSlug: record.currentOrgSlug,
        cachedAt: record.cachedAt,
      };
    },

    async put(snapshot: IdentitySnapshot): Promise<void> {
      await db.identitySnapshot.put({
        id: 'current',
        userId: snapshot.userId,
        email: snapshot.email,
        organizationsJson: JSON.stringify(snapshot.organizations),
        currentOrgSlug: snapshot.currentOrgSlug,
        cachedAt: snapshot.cachedAt,
      });
    },

    async clear(): Promise<void> {
      await db.identitySnapshot.clear();
    },
  };
}
