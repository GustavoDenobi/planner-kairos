import { describe, expect, it, vi } from 'vitest';

import {
  listNavigationShortcutsForReading,
} from './navigation-shortcut-offline-use-cases';
import type { OfflineNavigationShortcutStore } from '@/application/ports/offline-navigation-shortcut-store';
import type { PieceFileNavigationShortcutRepository } from '@/application/ports/piece-file-navigation-shortcut-repository';

vi.mock('./file-cache-use-cases', () => ({
  isBrowserOnline: vi.fn(() => false),
}));

function createMemoryStore(): OfflineNavigationShortcutStore {
  const records = new Map<string, import('@/application/ports/offline-navigation-shortcut-store').LocalPdfNavigationShortcut>();

  return {
    async listForFile(_organizationId, pieceFileId) {
      return [...records.values()]
        .filter((item) => item.pieceFileId === pieceFileId && item.syncStatus !== 'deleted_pending')
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async upsert(shortcut) {
      records.set(shortcut.clientId, shortcut);
    },
    async removeLocal(_organizationId, _pieceFileId, clientId) {
      records.delete(clientId);
    },
    async replaceClientId(clientId, serverId, updatedAt) {
      const record = records.get(clientId);
      if (!record) {
        return;
      }
      records.delete(clientId);
      records.set(serverId, {
        ...record,
        clientId: serverId,
        id: serverId,
        updatedAt,
        syncStatus: 'synced',
      });
    },
    async listPendingForFile(_organizationId, pieceFileId) {
      return [...records.values()].filter(
        (item) => item.pieceFileId === pieceFileId && item.syncStatus === 'pending',
      );
    },
    async enqueueOutbox() {},
    async listOutbox() {
      return [];
    },
    async removeOutbox() {},
    async incrementOutboxRetry() {},
    async clearAll() {
      records.clear();
    },
  };
}

describe('navigation shortcut offline use cases', () => {
  it('lists cached shortcuts when offline', async () => {
    const store = createMemoryStore();
    const repo: PieceFileNavigationShortcutRepository = {
      listForFile: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reorder: vi.fn(),
    };

    await store.upsert({
      clientId: 'shortcut-1',
      id: 'shortcut-1',
      organizationId: 'org-1',
      pieceFileId: 'file-1',
      label: 'Segno',
      color: '#2563eb',
      sortOrder: 0,
      targetPageNumber: 3,
      targetX: 0.5,
      targetY: null,
      anchorPageNumber: null,
      anchorX: null,
      anchorY: null,
      authorUserId: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: 'synced',
    });

    const result = await listNavigationShortcutsForReading(repo, store, 'org-1', 'file-1');

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual([
      expect.objectContaining({ label: 'Segno', targetPageNumber: 3 }),
    ]);
  });
});
