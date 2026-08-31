import type {
  LocalPieceFileTocEntry,
  OfflineTocEntryStore,
  TocEntrySyncOutboxItem,
} from '@/application/ports/offline-toc-entry-store';
import { getOfflineDb, type CachedTocEntryRecord } from './db';

function toLocal(record: CachedTocEntryRecord): LocalPieceFileTocEntry {
  return {
    clientId: record.clientId,
    id: record.id,
    organizationId: record.organizationId,
    pieceFileId: record.pieceFileId,
    label: record.label,
    sortOrder: record.sortOrder,
    targetPageNumber: record.targetPageNumber,
    targetX: record.targetX,
    targetY: record.targetY,
    endPageNumber: record.endPageNumber,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncStatus: record.syncStatus,
  };
}

function toRecord(entry: LocalPieceFileTocEntry): CachedTocEntryRecord {
  return {
    clientId: entry.clientId,
    id: entry.id,
    organizationId: entry.organizationId,
    pieceFileId: entry.pieceFileId,
    label: entry.label,
    sortOrder: entry.sortOrder,
    targetPageNumber: entry.targetPageNumber,
    targetX: entry.targetX,
    targetY: entry.targetY,
    endPageNumber: entry.endPageNumber,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    syncStatus: entry.syncStatus,
  };
}

export function createOfflineTocEntryStore(): OfflineTocEntryStore {
  const db = getOfflineDb();

  return {
    async listForFile(organizationId: string, pieceFileId: string) {
      const records = await db.cachedTocEntries
        .where('[organizationId+pieceFileId]')
        .equals([organizationId, pieceFileId])
        .toArray();
      return records
        .filter((record) => record.syncStatus !== 'deleted_pending')
        .map(toLocal)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },

    async upsert(entry: LocalPieceFileTocEntry) {
      await db.cachedTocEntries.put(toRecord(entry));
    },

    async removeLocal(organizationId: string, pieceFileId: string, clientId: string) {
      const record = await db.cachedTocEntries.get(clientId);
      if (
        !record
        || record.organizationId !== organizationId
        || record.pieceFileId !== pieceFileId
      ) {
        return;
      }
      await db.cachedTocEntries.delete(clientId);
    },

    async replaceClientId(clientId: string, serverId: string, updatedAt: string) {
      const record = await db.cachedTocEntries.get(clientId);
      if (!record) {
        return;
      }
      await db.cachedTocEntries.delete(clientId);
      await db.cachedTocEntries.put({
        ...record,
        clientId: serverId,
        id: serverId,
        updatedAt,
        syncStatus: 'synced',
      });
    },

    async listPendingForFile(organizationId: string, pieceFileId: string) {
      const records = await db.cachedTocEntries
        .where('[organizationId+pieceFileId]')
        .equals([organizationId, pieceFileId])
        .toArray();
      return records.filter((record) => record.syncStatus === 'pending').map(toLocal);
    },

    async enqueueOutbox(item: Omit<TocEntrySyncOutboxItem, 'retryCount'>) {
      await db.tocEntrySyncOutbox.put({
        id: item.id,
        op: item.op,
        payloadJson: JSON.stringify(item.payload),
        createdAt: item.createdAt,
        retryCount: 0,
      });
    },

    async listOutbox() {
      const records = await db.tocEntrySyncOutbox.orderBy('createdAt').toArray();
      return records.map((record) => ({
        id: record.id,
        op: record.op,
        payload: JSON.parse(record.payloadJson) as TocEntrySyncOutboxItem['payload'],
        createdAt: record.createdAt,
        retryCount: record.retryCount,
      }));
    },

    async removeOutbox(id: string) {
      await db.tocEntrySyncOutbox.delete(id);
    },

    async incrementOutboxRetry(id: string) {
      const record = await db.tocEntrySyncOutbox.get(id);
      if (!record) {
        return;
      }
      await db.tocEntrySyncOutbox.put({
        ...record,
        retryCount: record.retryCount + 1,
      });
    },

    async clearAll() {
      await db.cachedTocEntries.clear();
      await db.tocEntrySyncOutbox.clear();
    },
  };
}
