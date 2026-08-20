import type { OfflineAgendaCache } from '@/application/ports/offline-agenda-cache';
import { getOfflineDb } from './db';

function cacheKey(organizationId: string, userId: string): string {
  return `${organizationId}:${userId}`;
}

export function createOfflineAgendaCache(): OfflineAgendaCache {
  const db = getOfflineDb();

  return {
    async get(organizationId, userId) {
      const record = await db.cachedAgenda.get(cacheKey(organizationId, userId));
      if (!record) {
        return null;
      }
      return {
        organizationId: record.organizationId,
        userId: record.userId,
        cachedAt: record.cachedAt,
        rangeFrom: record.rangeFrom,
        rangeTo: record.rangeTo,
        eventsJson: record.eventsJson,
        eventDetailsJson: record.eventDetailsJson,
        eventTypesJson: record.eventTypesJson,
        audienceJson: record.audienceJson,
      };
    },

    async put(snapshot) {
      await db.cachedAgenda.put({
        cacheKey: cacheKey(snapshot.organizationId, snapshot.userId),
        organizationId: snapshot.organizationId,
        userId: snapshot.userId,
        cachedAt: snapshot.cachedAt,
        rangeFrom: snapshot.rangeFrom,
        rangeTo: snapshot.rangeTo,
        eventsJson: snapshot.eventsJson,
        eventDetailsJson: snapshot.eventDetailsJson,
        eventTypesJson: snapshot.eventTypesJson,
        audienceJson: snapshot.audienceJson,
      });
    },

    async remove(organizationId, userId) {
      await db.cachedAgenda.delete(cacheKey(organizationId, userId));
    },

    async clearAll() {
      await db.cachedAgenda.clear();
    },
  };
}
