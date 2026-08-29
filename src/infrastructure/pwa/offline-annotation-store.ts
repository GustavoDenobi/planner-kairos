import type {
  LocalAnnotationSet,
  LocalPdfAnnotation,
  OfflineAnnotationStore,
  SyncOutboxItem,
} from '@/application/ports/offline-annotation-store';
import type { AnnotationGeometry } from '@/domain/repertoire';
import {
  getOfflineDb,
  type CachedAnnotationRecord,
  type CachedAnnotationSetRecord,
} from './db';

function toLocal(record: CachedAnnotationRecord): LocalPdfAnnotation {
  return {
    clientId: record.clientId,
    id: record.id,
    organizationId: record.organizationId,
    pieceFileId: record.pieceFileId,
    pageNumber: record.pageNumber,
    layer: record.layer,
    type: record.type,
    geometry: JSON.parse(record.geometryJson) as AnnotationGeometry,
    color: record.color,
    authorUserId: record.authorUserId,
    sectionId: record.sectionId,
    annotationSetId: record.annotationSetId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncStatus: record.syncStatus,
  };
}

function toRecord(annotation: LocalPdfAnnotation): CachedAnnotationRecord {
  return {
    clientId: annotation.clientId,
    id: annotation.id,
    organizationId: annotation.organizationId,
    pieceFileId: annotation.pieceFileId,
    pageNumber: annotation.pageNumber,
    layer: annotation.layer,
    type: annotation.type,
    geometryJson: JSON.stringify(annotation.geometry),
    color: annotation.color,
    authorUserId: annotation.authorUserId,
    sectionId: annotation.sectionId,
    annotationSetId: annotation.annotationSetId,
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt,
    syncStatus: annotation.syncStatus,
  };
}

function toLocalSet(record: CachedAnnotationSetRecord): LocalAnnotationSet {
  const audience = JSON.parse(record.audienceJson) as LocalAnnotationSet['groups'] extends never
    ? never
    : {
        groupIds?: string[];
        musicianIds?: string[];
        groups: LocalAnnotationSet['groups'];
        musicians: LocalAnnotationSet['musicians'];
      };
  return {
    id: record.id,
    organizationId: record.organizationId,
    pieceFileId: record.pieceFileId,
    authorUserId: record.authorUserId,
    title: record.title,
    groups: audience.groups ?? [],
    musicians: audience.musicians ?? [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncStatus: record.syncStatus,
  };
}

function toSetRecord(set: LocalAnnotationSet): CachedAnnotationSetRecord {
  return {
    id: set.id,
    organizationId: set.organizationId,
    pieceFileId: set.pieceFileId,
    authorUserId: set.authorUserId,
    title: set.title,
    audienceJson: JSON.stringify({
      groupIds: set.groups.map((group) => group.id),
      musicianIds: set.musicians.map((musician) => musician.id),
      groups: set.groups,
      musicians: set.musicians,
    }),
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
    syncStatus: set.syncStatus,
  };
}

export function createOfflineAnnotationStore(): OfflineAnnotationStore {
  const db = getOfflineDb();

  return {
    async listForFile(organizationId: string, pieceFileId: string): Promise<LocalPdfAnnotation[]> {
      const records = await db.cachedAnnotations
        .where('[organizationId+pieceFileId]')
        .equals([organizationId, pieceFileId])
        .toArray();
      return records
        .filter((record) => record.syncStatus !== 'deleted_pending')
        .map(toLocal);
    },

    async upsert(annotation: LocalPdfAnnotation): Promise<void> {
      await db.cachedAnnotations.put(toRecord(annotation));
    },

    async removeLocal(
      organizationId: string,
      pieceFileId: string,
      clientId: string,
    ): Promise<void> {
      let record = await db.cachedAnnotations.get(clientId);
      if (!record) {
        record = await db.cachedAnnotations
          .where('[organizationId+pieceFileId]')
          .equals([organizationId, pieceFileId])
          .filter((item) => item.id === clientId || item.clientId === clientId)
          .first();
      }
      if (!record || record.organizationId !== organizationId || record.pieceFileId !== pieceFileId) {
        return;
      }
      await db.cachedAnnotations.delete(record.clientId);
    },

    async replaceClientId(clientId: string, serverId: string, updatedAt: string): Promise<void> {
      const record = await db.cachedAnnotations.get(clientId);
      if (!record) {
        return;
      }
      await db.cachedAnnotations.delete(clientId);
      await db.cachedAnnotations.put({
        ...record,
        clientId: serverId,
        id: serverId,
        updatedAt,
        syncStatus: 'synced',
      });
    },

    async listPendingForFile(
      organizationId: string,
      pieceFileId: string,
    ): Promise<LocalPdfAnnotation[]> {
      const records = await db.cachedAnnotations
        .where('[organizationId+pieceFileId]')
        .equals([organizationId, pieceFileId])
        .toArray();
      return records.filter((record) => record.syncStatus === 'pending').map(toLocal);
    },

    async pendingSyncCount(organizationId: string, pieceFileId?: string): Promise<number> {
      const items = await db.syncOutbox.toArray();
      return items.filter((item) => {
        const payload = JSON.parse(item.payloadJson) as SyncOutboxItem['payload'];
        if (payload.organizationId !== organizationId) {
          return false;
        }
        if (!pieceFileId) {
          return true;
        }
        if ('pieceFileId' in payload && payload.pieceFileId === pieceFileId) {
          return true;
        }
        if ('input' in payload && 'pieceFileId' in payload.input && payload.input.pieceFileId === pieceFileId) {
          return true;
        }
        return false;
      }).length;
    },

    async listSetsForFile(organizationId: string, pieceFileId: string): Promise<LocalAnnotationSet[]> {
      const records = await db.cachedAnnotationSets
        .where('[organizationId+pieceFileId]')
        .equals([organizationId, pieceFileId])
        .toArray();
      return records
        .filter((record) => record.syncStatus !== 'deleted_pending')
        .map(toLocalSet);
    },

    async upsertSet(set: LocalAnnotationSet): Promise<void> {
      await db.cachedAnnotationSets.put(toSetRecord(set));
    },

    async removeSet(organizationId: string, pieceFileId: string, setId: string): Promise<void> {
      const record = await db.cachedAnnotationSets.get(setId);
      if (!record || record.organizationId !== organizationId || record.pieceFileId !== pieceFileId) {
        return;
      }
      await db.cachedAnnotationSets.delete(setId);
    },

    async replaceSetId(clientId: string, serverSet: LocalAnnotationSet): Promise<void> {
      await db.cachedAnnotationSets.delete(clientId);
      await db.cachedAnnotationSets.put(toSetRecord({ ...serverSet, syncStatus: 'synced' }));

      const annotations = await db.cachedAnnotations
        .where('[organizationId+pieceFileId]')
        .equals([serverSet.organizationId, serverSet.pieceFileId])
        .filter((record) => record.annotationSetId === clientId)
        .toArray();

      const now = new Date().toISOString();
      for (const record of annotations) {
        await db.cachedAnnotations.put({
          ...record,
          annotationSetId: serverSet.id,
          updatedAt: now,
        });
      }
    },

    async enqueueOutbox(item: Omit<SyncOutboxItem, 'retryCount'>): Promise<void> {
      await db.syncOutbox.put({
        id: item.id,
        op: item.op,
        payloadJson: JSON.stringify(item.payload),
        createdAt: item.createdAt,
        retryCount: 0,
      });
    },

    async listOutbox(): Promise<SyncOutboxItem[]> {
      const records = await db.syncOutbox.orderBy('createdAt').toArray();
      return records.map((record) => ({
        id: record.id,
        op: record.op,
        payload: JSON.parse(record.payloadJson) as SyncOutboxItem['payload'],
        createdAt: record.createdAt,
        retryCount: record.retryCount,
      }));
    },

    async removeOutbox(id: string): Promise<void> {
      await db.syncOutbox.delete(id);
    },

    async incrementOutboxRetry(id: string): Promise<void> {
      const record = await db.syncOutbox.get(id);
      if (!record) {
        return;
      }
      await db.syncOutbox.put({ ...record, retryCount: record.retryCount + 1 });
    },

    async clearAll(): Promise<void> {
      await db.cachedAnnotations.clear();
      await db.cachedAnnotationSets.clear();
      await db.syncOutbox.clear();
    },
  };
}
