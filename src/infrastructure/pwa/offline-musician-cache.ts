import type { OfflineMusicianCache } from '@/application/ports/offline-musician-cache';
import { getOfflineDb } from './db';

function cacheKey(organizationId: string, userId: string): string {
  return `${organizationId}:${userId}`;
}

export function createOfflineMusicianCache(): OfflineMusicianCache {
  const db = getOfflineDb();

  return {
    async get(organizationId, userId) {
      const record = await db.cachedMusicians.get(cacheKey(organizationId, userId));
      if (!record) {
        return null;
      }
      return {
        organizationId: record.organizationId,
        userId: record.userId,
        cachedAt: record.cachedAt,
        musiciansJson: record.musiciansJson,
        assignmentsJson: record.assignmentsJson,
        groupsJson: record.groupsJson,
        partsJson: record.partsJson,
        sectionsJson: record.sectionsJson,
        assignmentsByGroupJson: record.assignmentsByGroupJson ?? '{}',
        sectionPartIdsByGroupJson: record.sectionPartIdsByGroupJson ?? '{}',
      };
    },

    async put(snapshot) {
      await db.cachedMusicians.put({
        cacheKey: cacheKey(snapshot.organizationId, snapshot.userId),
        organizationId: snapshot.organizationId,
        userId: snapshot.userId,
        cachedAt: snapshot.cachedAt,
        musiciansJson: snapshot.musiciansJson,
        assignmentsJson: snapshot.assignmentsJson,
        groupsJson: snapshot.groupsJson,
        partsJson: snapshot.partsJson,
        sectionsJson: snapshot.sectionsJson,
        assignmentsByGroupJson: snapshot.assignmentsByGroupJson,
        sectionPartIdsByGroupJson: snapshot.sectionPartIdsByGroupJson,
      });
    },

    async remove(organizationId, userId) {
      await db.cachedMusicians.delete(cacheKey(organizationId, userId));
    },

    async clearAll() {
      await db.cachedMusicians.clear();
    },
  };
}
