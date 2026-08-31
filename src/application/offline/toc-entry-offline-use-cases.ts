import type { OfflineTocEntryStore } from '@/application/ports/offline-toc-entry-store';
import type { PieceFileTocEntryRepository } from '@/application/ports/piece-file-toc-entry-repository';
import type {
  CreatePieceFileTocEntryInput,
  PieceFileTocEntry,
  UpdatePieceFileTocEntryInput,
} from '@/domain/repertoire';
import { Result } from '@/domain/shared';
import { isBrowserOnline } from './file-cache-use-cases';

function toPieceFileTocEntry(
  local: PieceFileTocEntry & { clientId?: string },
): PieceFileTocEntry {
  return {
    id: local.id,
    organizationId: local.organizationId,
    pieceFileId: local.pieceFileId,
    label: local.label,
    sortOrder: local.sortOrder,
    targetPageNumber: local.targetPageNumber,
    targetX: local.targetX,
    targetY: local.targetY,
    endPageNumber: local.endPageNumber,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  };
}

export async function listTocEntriesForReading(
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
  organizationId: string,
  pieceFileId: string,
): Promise<Result<PieceFileTocEntry[], string>> {
  if (isBrowserOnline()) {
    try {
      const serverEntries = await tocRepo.listForFile(organizationId, pieceFileId);
      for (const entry of serverEntries) {
        await tocStore.upsert({
          clientId: entry.id,
          ...entry,
          syncStatus: 'synced',
        });
      }
    } catch {
      /* Keep locally cached entries when the server cannot be reached. */
    }
  }

  const local = await tocStore.listForFile(organizationId, pieceFileId);
  const pending = await tocStore.listPendingForFile(organizationId, pieceFileId);

  const tombstoneIds = new Set(
    (await tocStore.listOutbox())
      .filter((item) => item.op === 'toc_delete')
      .map((item) => {
        const payload = item.payload as { entryId: string; pieceFileId: string };
        return payload.pieceFileId === pieceFileId ? payload.entryId : null;
      })
      .filter((id): id is string => Boolean(id)),
  );

  const merged = new Map<string, PieceFileTocEntry>();
  for (const item of local) {
    if (!tombstoneIds.has(item.id)) {
      merged.set(item.clientId, toPieceFileTocEntry(item));
    }
  }
  for (const item of pending) {
    merged.set(item.clientId, toPieceFileTocEntry(item));
  }

  return Result.ok(
    Array.from(merged.values()).sort((a, b) => a.sortOrder - b.sortOrder),
  );
}

export async function createTocEntryWithOffline(
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
  organizationId: string,
  pieceId: string,
  input: CreatePieceFileTocEntryInput,
): Promise<Result<PieceFileTocEntry, string>> {
  const clientId = `draft-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const existing = await tocStore.listForFile(organizationId, input.pieceFileId);

  const localEntry = {
    clientId,
    id: clientId,
    organizationId,
    pieceFileId: input.pieceFileId,
    label: input.label.trim(),
    sortOrder: input.sortOrder ?? existing.length,
    targetPageNumber: input.targetPageNumber,
    targetX: input.targetX ?? null,
    targetY: input.targetY ?? null,
    endPageNumber: input.endPageNumber ?? null,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending' as const,
  };

  if (isBrowserOnline()) {
    try {
      const created = await tocRepo.create(organizationId, input);
      await tocStore.upsert({
        ...localEntry,
        clientId: created.id,
        id: created.id,
        label: created.label,
        sortOrder: created.sortOrder,
        targetPageNumber: created.targetPageNumber,
        targetX: created.targetX,
        targetY: created.targetY,
        endPageNumber: created.endPageNumber,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        syncStatus: 'synced',
      });
      return Result.ok(created);
    } catch {
      // fall through to offline queue
    }
  }

  await tocStore.upsert(localEntry);
  await tocStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'toc_create',
    payload: {
      clientId,
      organizationId,
      pieceId,
      input,
    },
    createdAt: now,
  });

  return Result.ok(toPieceFileTocEntry(localEntry));
}

export async function updateTocEntryWithOffline(
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
  organizationId: string,
  pieceFileId: string,
  entryId: string,
  input: UpdatePieceFileTocEntryInput,
): Promise<Result<PieceFileTocEntry, string>> {
  const isDraft = entryId.startsWith('draft-');
  const existingLocal = (await tocStore.listForFile(organizationId, pieceFileId)).find(
    (item) => item.id === entryId || item.clientId === entryId,
  );

  if (isBrowserOnline() && !isDraft) {
    try {
      const updated = await tocRepo.update(organizationId, pieceFileId, entryId, input);
      if (updated) {
        await tocStore.upsert({
          clientId: updated.id,
          ...updated,
          syncStatus: 'synced',
        });
        return Result.ok(updated);
      }
    } catch {
      // fall through
    }
  }

  if (!existingLocal) {
    return Result.fail('not_found');
  }

  const now = new Date().toISOString();
  const merged = {
    ...existingLocal,
    label: input.label?.trim() ?? existingLocal.label,
    sortOrder: input.sortOrder ?? existingLocal.sortOrder,
    targetPageNumber: input.targetPageNumber ?? existingLocal.targetPageNumber,
    targetX: input.targetX !== undefined ? input.targetX : existingLocal.targetX,
    targetY: input.targetY !== undefined ? input.targetY : existingLocal.targetY,
    endPageNumber:
      input.endPageNumber !== undefined ? input.endPageNumber : existingLocal.endPageNumber,
    updatedAt: now,
    syncStatus: 'pending' as const,
  };

  await tocStore.upsert(merged);

  if (isDraft) {
    const outbox = await tocStore.listOutbox();
    for (const item of outbox) {
      if (
        item.op === 'toc_create'
        && 'clientId' in item.payload
        && item.payload.clientId === entryId
      ) {
        await tocStore.removeOutbox(item.id);
        await tocStore.enqueueOutbox({
          id: crypto.randomUUID(),
          op: 'toc_create',
          payload: {
            clientId: entryId,
            organizationId,
            pieceId: '',
            input: {
              pieceFileId,
              label: merged.label,
              sortOrder: merged.sortOrder,
              targetPageNumber: merged.targetPageNumber,
              targetX: merged.targetX,
              targetY: merged.targetY,
              endPageNumber: merged.endPageNumber,
            },
          },
          createdAt: now,
        });
      }
    }
  } else {
    await tocStore.enqueueOutbox({
      id: crypto.randomUUID(),
      op: 'toc_update',
      payload: {
        organizationId,
        pieceFileId,
        entryId,
        input,
      },
      createdAt: now,
    });
  }

  return Result.ok(toPieceFileTocEntry(merged));
}

export async function deleteTocEntryWithOffline(
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
  organizationId: string,
  pieceFileId: string,
  entryId: string,
): Promise<Result<void, string>> {
  const isDraft = entryId.startsWith('draft-');

  if (isDraft) {
    await tocStore.removeLocal(organizationId, pieceFileId, entryId);
    const outbox = await tocStore.listOutbox();
    for (const item of outbox) {
      if (item.op === 'toc_create' && 'clientId' in item.payload && item.payload.clientId === entryId) {
        await tocStore.removeOutbox(item.id);
      }
    }
    return Result.ok(undefined);
  }

  if (isBrowserOnline()) {
    const removed = await tocRepo.remove(organizationId, pieceFileId, entryId);
    if (removed) {
      await tocStore.removeLocal(organizationId, pieceFileId, entryId);
      return Result.ok(undefined);
    }
  }

  const now = new Date().toISOString();
  await tocStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'toc_delete',
    payload: {
      organizationId,
      pieceFileId,
      entryId,
    },
    createdAt: now,
  });
  await tocStore.removeLocal(organizationId, pieceFileId, entryId);

  return Result.ok(undefined);
}

export async function reorderTocEntriesWithOffline(
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
  organizationId: string,
  pieceFileId: string,
  orderedIds: string[],
): Promise<Result<PieceFileTocEntry[], string>> {
  if (isBrowserOnline()) {
    try {
      const reordered = await tocRepo.reorder(organizationId, pieceFileId, orderedIds);
      for (const entry of reordered) {
        await tocStore.upsert({
          clientId: entry.id,
          ...entry,
          syncStatus: 'synced',
        });
      }
      return Result.ok(reordered);
    } catch {
      // fall through
    }
  }

  const local = await tocStore.listForFile(organizationId, pieceFileId);
  const byId = new Map(local.map((item) => [item.id, item]));
  const now = new Date().toISOString();

  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index]!;
    const item = byId.get(id);
    if (item) {
      await tocStore.upsert({
        ...item,
        sortOrder: index,
        updatedAt: now,
        syncStatus: item.id.startsWith('draft-') ? 'pending' : item.syncStatus,
      });
    }
  }

  await tocStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'toc_reorder',
    payload: {
      organizationId,
      pieceFileId,
      orderedIds: orderedIds.filter((id) => !id.startsWith('draft-')),
    },
    createdAt: now,
  });

  const updated = await tocStore.listForFile(organizationId, pieceFileId);
  return Result.ok(updated.map(toPieceFileTocEntry));
}

export async function syncPendingTocEntryChanges(
  tocRepo: PieceFileTocEntryRepository,
  tocStore: OfflineTocEntryStore,
): Promise<{ synced: number; failed: number }> {
  if (!isBrowserOnline()) {
    return { synced: 0, failed: 0 };
  }

  const outbox = await tocStore.listOutbox();
  let synced = 0;
  let failed = 0;

  for (const item of outbox) {
    try {
      if (item.op === 'toc_create') {
        const payload = item.payload as {
          clientId: string;
          organizationId: string;
          input: CreatePieceFileTocEntryInput;
        };
        const created = await tocRepo.create(payload.organizationId, payload.input);
        await tocStore.replaceClientId(payload.clientId, created.id, created.updatedAt);
        await tocStore.removeOutbox(item.id);
        synced += 1;
      } else if (item.op === 'toc_update') {
        const payload = item.payload as {
          organizationId: string;
          pieceFileId: string;
          entryId: string;
          input: UpdatePieceFileTocEntryInput;
        };
        const updated = await tocRepo.update(
          payload.organizationId,
          payload.pieceFileId,
          payload.entryId,
          payload.input,
        );
        if (updated) {
          await tocStore.upsert({
            clientId: updated.id,
            ...updated,
            syncStatus: 'synced',
          });
          await tocStore.removeOutbox(item.id);
          synced += 1;
        } else {
          failed += 1;
        }
      } else if (item.op === 'toc_delete') {
        const payload = item.payload as {
          organizationId: string;
          pieceFileId: string;
          entryId: string;
        };
        await tocRepo.remove(payload.organizationId, payload.pieceFileId, payload.entryId);
        await tocStore.removeOutbox(item.id);
        synced += 1;
      } else if (item.op === 'toc_reorder') {
        const payload = item.payload as {
          organizationId: string;
          pieceFileId: string;
          orderedIds: string[];
        };
        if (payload.orderedIds.length > 0) {
          await tocRepo.reorder(payload.organizationId, payload.pieceFileId, payload.orderedIds);
        }
        await tocStore.removeOutbox(item.id);
        synced += 1;
      }
    } catch {
      await tocStore.incrementOutboxRetry(item.id);
      failed += 1;
    }
  }

  return { synced, failed };
}
