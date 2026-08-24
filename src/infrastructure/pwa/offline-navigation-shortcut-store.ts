import type {
  LocalPdfNavigationShortcut,
  NavigationShortcutSyncOutboxItem,
  OfflineNavigationShortcutStore,
} from '@/application/ports/offline-navigation-shortcut-store';
import { resolveNavigationShortcutColor } from '@/domain/repertoire';
import { getOfflineDb, type CachedNavigationShortcutRecord } from './db';

function toLocal(record: CachedNavigationShortcutRecord): LocalPdfNavigationShortcut {
  return {
    clientId: record.clientId,
    id: record.id,
    organizationId: record.organizationId,
    pieceFileId: record.pieceFileId,
    label: record.label,
    color: resolveNavigationShortcutColor(record.color, record.sortOrder),
    sortOrder: record.sortOrder,
    targetPageNumber: record.targetPageNumber,
    targetX: record.targetX,
    targetY: record.targetY,
    anchorPageNumber: record.anchorPageNumber,
    anchorX: record.anchorX,
    anchorY: record.anchorY,
    authorUserId: record.authorUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncStatus: record.syncStatus,
  };
}

function toRecord(shortcut: LocalPdfNavigationShortcut): CachedNavigationShortcutRecord {
  return {
    clientId: shortcut.clientId,
    id: shortcut.id,
    organizationId: shortcut.organizationId,
    pieceFileId: shortcut.pieceFileId,
    label: shortcut.label,
    color: shortcut.color,
    sortOrder: shortcut.sortOrder,
    targetPageNumber: shortcut.targetPageNumber,
    targetX: shortcut.targetX,
    targetY: shortcut.targetY,
    anchorPageNumber: shortcut.anchorPageNumber,
    anchorX: shortcut.anchorX,
    anchorY: shortcut.anchorY,
    authorUserId: shortcut.authorUserId,
    createdAt: shortcut.createdAt,
    updatedAt: shortcut.updatedAt,
    syncStatus: shortcut.syncStatus,
  };
}

export function createOfflineNavigationShortcutStore(): OfflineNavigationShortcutStore {
  const db = getOfflineDb();

  return {
    async listForFile(organizationId: string, pieceFileId: string) {
      const records = await db.cachedNavigationShortcuts
        .where('[organizationId+pieceFileId]')
        .equals([organizationId, pieceFileId])
        .toArray();
      return records
        .filter((record) => record.syncStatus !== 'deleted_pending')
        .map(toLocal)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },

    async upsert(shortcut: LocalPdfNavigationShortcut) {
      await db.cachedNavigationShortcuts.put(toRecord(shortcut));
    },

    async removeLocal(organizationId: string, pieceFileId: string, clientId: string) {
      const record = await db.cachedNavigationShortcuts.get(clientId);
      if (
        !record
        || record.organizationId !== organizationId
        || record.pieceFileId !== pieceFileId
      ) {
        return;
      }
      await db.cachedNavigationShortcuts.delete(clientId);
    },

    async replaceClientId(clientId: string, serverId: string, updatedAt: string) {
      const record = await db.cachedNavigationShortcuts.get(clientId);
      if (!record) {
        return;
      }
      await db.cachedNavigationShortcuts.delete(clientId);
      await db.cachedNavigationShortcuts.put({
        ...record,
        clientId: serverId,
        id: serverId,
        updatedAt,
        syncStatus: 'synced',
      });
    },

    async listPendingForFile(organizationId: string, pieceFileId: string) {
      const records = await db.cachedNavigationShortcuts
        .where('[organizationId+pieceFileId]')
        .equals([organizationId, pieceFileId])
        .toArray();
      return records.filter((record) => record.syncStatus === 'pending').map(toLocal);
    },

    async enqueueOutbox(item: Omit<NavigationShortcutSyncOutboxItem, 'retryCount'>) {
      await db.navigationShortcutSyncOutbox.put({
        id: item.id,
        op: item.op,
        payloadJson: JSON.stringify(item.payload),
        createdAt: item.createdAt,
        retryCount: 0,
      });
    },

    async listOutbox() {
      const records = await db.navigationShortcutSyncOutbox.orderBy('createdAt').toArray();
      return records.map((record) => ({
        id: record.id,
        op: record.op,
        payload: JSON.parse(record.payloadJson) as NavigationShortcutSyncOutboxItem['payload'],
        createdAt: record.createdAt,
        retryCount: record.retryCount,
      }));
    },

    async removeOutbox(id: string) {
      await db.navigationShortcutSyncOutbox.delete(id);
    },

    async incrementOutboxRetry(id: string) {
      const record = await db.navigationShortcutSyncOutbox.get(id);
      if (!record) {
        return;
      }
      await db.navigationShortcutSyncOutbox.put({
        ...record,
        retryCount: record.retryCount + 1,
      });
    },

    async clearAll() {
      await db.cachedNavigationShortcuts.clear();
      await db.navigationShortcutSyncOutbox.clear();
    },
  };
}
