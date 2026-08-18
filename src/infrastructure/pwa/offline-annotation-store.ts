import type {
  LocalPdfAnnotation,
  OfflineAnnotationStore,
  SyncOutboxItem,
} from '@/application/ports/offline-annotation-store';
import type { AnnotationGeometry } from '@/domain/repertoire';
import { getOfflineDb, type CachedAnnotationRecord } from './db';

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
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt,
    syncStatus: annotation.syncStatus,
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
      const record = await db.cachedAnnotations.get(clientId);
      if (!record || record.organizationId !== organizationId || record.pieceFileId !== pieceFileId) {
        return;
      }
      await db.cachedAnnotations.delete(clientId);
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
      const outboxCount = await db.syncOutbox.count();
      if (outboxCount > 0) {
        const items = await db.syncOutbox.toArray();
        const filtered = items.filter((item) => {
          const payload = JSON.parse(item.payloadJson) as SyncOutboxItem['payload'];
          if (payload.organizationId !== organizationId) {
            return false;
          }
          if (pieceFileId && 'pieceFileId' in payload && payload.pieceFileId !== pieceFileId) {
            return false;
          }
          if (
            pieceFileId &&
            'input' in payload &&
            payload.input.pieceFileId !== pieceFileId
          ) {
            return false;
          }
          return true;
        });
        return filtered.length;
      }
      return 0;
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
      await db.syncOutbox.clear();
    },
  };
}
