import { describe, expect, it } from 'vitest';
import type { OfflineAnnotationStore } from '@/application/ports/offline-annotation-store';
import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import { listAnnotationsForReading } from '@/application/offline/annotation-offline-use-cases';

function createAnnotationStore(): OfflineAnnotationStore {
  const annotations: import('@/application/ports/offline-annotation-store').LocalPdfAnnotation[] =
    [];
  const outbox: import('@/application/ports/offline-annotation-store').SyncOutboxItem[] = [];

  return {
    listForFile: async (_orgId, pieceFileId) =>
      annotations.filter((a) => a.pieceFileId === pieceFileId && a.syncStatus !== 'deleted_pending'),
    upsert: async (annotation) => {
      const index = annotations.findIndex((a) => a.clientId === annotation.clientId);
      if (index >= 0) {
        annotations[index] = annotation;
      } else {
        annotations.push(annotation);
      }
    },
    removeLocal: async (_orgId, pieceFileId, clientId) => {
      const index = annotations.findIndex(
        (a) => a.clientId === clientId && a.pieceFileId === pieceFileId,
      );
      if (index >= 0) {
        annotations.splice(index, 1);
      }
    },
    replaceClientId: async (clientId, serverId, updatedAt) => {
      const index = annotations.findIndex((a) => a.clientId === clientId);
      if (index >= 0) {
        annotations[index] = {
          ...annotations[index],
          clientId: serverId,
          id: serverId,
          updatedAt,
          syncStatus: 'synced',
        };
      }
    },
    listPendingForFile: async (_orgId, pieceFileId) =>
      annotations.filter((a) => a.pieceFileId === pieceFileId && a.syncStatus === 'pending'),
    pendingSyncCount: async () => outbox.length,
    enqueueOutbox: async (item) => {
      outbox.push({ ...item, retryCount: 0 });
    },
    listOutbox: async () => outbox,
    removeOutbox: async (id) => {
      const index = outbox.findIndex((item) => item.id === id);
      if (index >= 0) {
        outbox.splice(index, 1);
      }
    },
    incrementOutboxRetry: async () => {},
    clearAll: async () => {
      annotations.length = 0;
      outbox.length = 0;
    },
  };
}

describe('listAnnotationsForReading', () => {
  it('merges pending local annotations with synced server data', async () => {
    const annotationStore = createAnnotationStore();
    const serverAnnotation = {
      id: 'ann-1',
      organizationId: 'org-1',
      pieceFileId: 'file-1',
      pageNumber: 1,
      layer: 'personal' as const,
      type: 'stroke' as const,
      geometry: { points: [{ x: 0.1, y: 0.1 }], strokeWidth: 0.01 },
      color: '#2563eb',
      authorUserId: 'user-1',
      sectionId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const annotationRepo: PieceFileAnnotationRepository = {
      listForFile: async () => [serverAnnotation],
      create: async () => serverAnnotation,
      update: async () => serverAnnotation,
      remove: async () => true,
    };

    await annotationStore.upsert({
      clientId: 'draft-local',
      id: 'draft-local',
      organizationId: 'org-1',
      pieceFileId: 'file-1',
      pageNumber: 2,
      layer: 'personal',
      type: 'stroke',
      geometry: { points: [{ x: 0.2, y: 0.2 }], strokeWidth: 0.01 },
      color: '#2563eb',
      authorUserId: 'user-1',
      sectionId: null,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      syncStatus: 'pending',
    });

    const result = await listAnnotationsForReading(
      annotationRepo,
      annotationStore,
      'org-1',
      'file-1',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBe(2);
      expect(result.value.map((a) => a.id)).toContain('ann-1');
      expect(result.value.map((a) => a.id)).toContain('draft-local');
    }
  });
});
