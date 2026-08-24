import type { OfflineNavigationShortcutStore } from '@/application/ports/offline-navigation-shortcut-store';
import type { PieceFileNavigationShortcutRepository } from '@/application/ports/piece-file-navigation-shortcut-repository';
import type {
  CreatePdfNavigationShortcutInput,
  PdfNavigationShortcut,
  UpdatePdfNavigationShortcutInput,
} from '@/domain/repertoire';
import {
  pickNavigationShortcutColor,
  resolveNavigationShortcutColor,
} from '@/domain/repertoire';
import { Result } from '@/domain/shared';
import { isBrowserOnline } from './file-cache-use-cases';

function toPdfNavigationShortcut(
  local: Omit<PdfNavigationShortcut, never> & { clientId?: string },
): PdfNavigationShortcut {
  return {
    id: local.id,
    organizationId: local.organizationId,
    pieceFileId: local.pieceFileId,
    label: local.label,
    color: resolveNavigationShortcutColor(local.color, local.sortOrder),
    sortOrder: local.sortOrder,
    targetPageNumber: local.targetPageNumber,
    targetX: local.targetX,
    targetY: local.targetY,
    anchorPageNumber: local.anchorPageNumber,
    anchorX: local.anchorX,
    anchorY: local.anchorY,
    authorUserId: local.authorUserId,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  };
}

export async function listNavigationShortcutsForReading(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  shortcutStore: OfflineNavigationShortcutStore,
  organizationId: string,
  pieceFileId: string,
): Promise<Result<PdfNavigationShortcut[], string>> {
  if (isBrowserOnline()) {
    try {
      const serverShortcuts = await shortcutRepo.listForFile(organizationId, pieceFileId);
      for (const shortcut of serverShortcuts) {
        await shortcutStore.upsert({
          clientId: shortcut.id,
          ...shortcut,
          syncStatus: 'synced',
        });
      }
    } catch {
      /* Keep locally cached shortcuts when the server cannot be reached. */
    }
  }

  const local = await shortcutStore.listForFile(organizationId, pieceFileId);
  const pending = await shortcutStore.listPendingForFile(organizationId, pieceFileId);

  const tombstoneIds = new Set(
    (await shortcutStore.listOutbox())
      .filter((item) => item.op === 'shortcut_delete')
      .map((item) => {
        const payload = item.payload as { shortcutId: string; pieceFileId: string };
        return payload.pieceFileId === pieceFileId ? payload.shortcutId : null;
      })
      .filter((id): id is string => Boolean(id)),
  );

  const merged = new Map<string, PdfNavigationShortcut>();
  for (const item of local) {
    if (!tombstoneIds.has(item.id)) {
      merged.set(item.clientId, toPdfNavigationShortcut(item));
    }
  }
  for (const item of pending) {
    merged.set(item.clientId, toPdfNavigationShortcut(item));
  }

  return Result.ok(
    Array.from(merged.values()).sort((a, b) => a.sortOrder - b.sortOrder),
  );
}

export async function createNavigationShortcutWithOffline(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  shortcutStore: OfflineNavigationShortcutStore,
  organizationId: string,
  pieceId: string,
  authorUserId: string,
  input: CreatePdfNavigationShortcutInput,
): Promise<Result<PdfNavigationShortcut, string>> {
  const clientId = `draft-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const existing = await shortcutStore.listForFile(organizationId, input.pieceFileId);
  const color = input.color?.trim() || pickNavigationShortcutColor(existing.map((item) => item.color));

  const localShortcut = {
    clientId,
    id: clientId,
    organizationId,
    pieceFileId: input.pieceFileId,
    label: input.label.trim(),
    color,
    sortOrder: input.sortOrder ?? existing.length,
    targetPageNumber: input.targetPageNumber,
    targetX: input.targetX ?? null,
    targetY: input.targetY ?? null,
    anchorPageNumber: input.anchorPageNumber ?? null,
    anchorX: input.anchorX ?? null,
    anchorY: input.anchorY ?? null,
    authorUserId,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending' as const,
  };

  if (isBrowserOnline()) {
    try {
      const created = await shortcutRepo.create(organizationId, authorUserId, input);
      await shortcutStore.upsert({
        ...localShortcut,
        clientId: created.id,
        id: created.id,
        label: created.label,
        color: created.color,
        sortOrder: created.sortOrder,
        targetPageNumber: created.targetPageNumber,
        targetX: created.targetX,
        targetY: created.targetY,
        anchorPageNumber: created.anchorPageNumber,
        anchorX: created.anchorX,
        anchorY: created.anchorY,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        syncStatus: 'synced',
      });
      return Result.ok(created);
    } catch {
      // fall through to offline queue
    }
  }

  await shortcutStore.upsert(localShortcut);
  await shortcutStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'shortcut_create',
    payload: {
      clientId,
      organizationId,
      pieceId,
      authorUserId,
      input,
    },
    createdAt: now,
  });

  return Result.ok(toPdfNavigationShortcut(localShortcut));
}

export async function updateNavigationShortcutWithOffline(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  shortcutStore: OfflineNavigationShortcutStore,
  organizationId: string,
  pieceFileId: string,
  shortcutId: string,
  input: UpdatePdfNavigationShortcutInput,
): Promise<Result<PdfNavigationShortcut, string>> {
  const isDraft = shortcutId.startsWith('draft-');
  const existingLocal = (await shortcutStore.listForFile(organizationId, pieceFileId)).find(
    (item) => item.id === shortcutId || item.clientId === shortcutId,
  );

  if (isBrowserOnline() && !isDraft) {
    try {
      const updated = await shortcutRepo.update(organizationId, pieceFileId, shortcutId, input);
      if (updated) {
        await shortcutStore.upsert({
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
    anchorPageNumber:
      input.anchorPageNumber !== undefined
        ? input.anchorPageNumber
        : existingLocal.anchorPageNumber,
    anchorX: input.anchorX !== undefined ? input.anchorX : existingLocal.anchorX,
    anchorY: input.anchorY !== undefined ? input.anchorY : existingLocal.anchorY,
    updatedAt: now,
    syncStatus: 'pending' as const,
  };

  await shortcutStore.upsert(merged);

  if (isDraft) {
    const outbox = await shortcutStore.listOutbox();
    for (const item of outbox) {
      if (
        item.op === 'shortcut_create'
        && 'clientId' in item.payload
        && item.payload.clientId === shortcutId
      ) {
        await shortcutStore.removeOutbox(item.id);
        await shortcutStore.enqueueOutbox({
          id: crypto.randomUUID(),
          op: 'shortcut_create',
          payload: {
            clientId: shortcutId,
            organizationId,
            pieceId: '',
            authorUserId: existingLocal.authorUserId,
            input: {
              pieceFileId,
              label: merged.label,
              sortOrder: merged.sortOrder,
              targetPageNumber: merged.targetPageNumber,
              targetX: merged.targetX,
              targetY: merged.targetY,
              anchorPageNumber: merged.anchorPageNumber,
              anchorX: merged.anchorX,
              anchorY: merged.anchorY,
            },
          },
          createdAt: now,
        });
      }
    }
  } else {
    await shortcutStore.enqueueOutbox({
      id: crypto.randomUUID(),
      op: 'shortcut_update',
      payload: {
        organizationId,
        pieceFileId,
        shortcutId,
        input,
      },
      createdAt: now,
    });
  }

  return Result.ok(toPdfNavigationShortcut(merged));
}

export async function deleteNavigationShortcutWithOffline(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  shortcutStore: OfflineNavigationShortcutStore,
  organizationId: string,
  pieceFileId: string,
  shortcutId: string,
): Promise<Result<void, string>> {
  const isDraft = shortcutId.startsWith('draft-');

  if (isDraft) {
    await shortcutStore.removeLocal(organizationId, pieceFileId, shortcutId);
    const outbox = await shortcutStore.listOutbox();
    for (const item of outbox) {
      if (item.op === 'shortcut_create' && 'clientId' in item.payload && item.payload.clientId === shortcutId) {
        await shortcutStore.removeOutbox(item.id);
      }
    }
    return Result.ok(undefined);
  }

  if (isBrowserOnline()) {
    const removed = await shortcutRepo.remove(organizationId, pieceFileId, shortcutId);
    if (removed) {
      await shortcutStore.removeLocal(organizationId, pieceFileId, shortcutId);
      return Result.ok(undefined);
    }
  }

  const now = new Date().toISOString();
  await shortcutStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'shortcut_delete',
    payload: {
      organizationId,
      pieceFileId,
      shortcutId,
    },
    createdAt: now,
  });
  await shortcutStore.removeLocal(organizationId, pieceFileId, shortcutId);

  return Result.ok(undefined);
}

export async function reorderNavigationShortcutsWithOffline(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  shortcutStore: OfflineNavigationShortcutStore,
  organizationId: string,
  pieceFileId: string,
  orderedIds: string[],
): Promise<Result<PdfNavigationShortcut[], string>> {
  if (isBrowserOnline()) {
    try {
      const reordered = await shortcutRepo.reorder(organizationId, pieceFileId, orderedIds);
      for (const shortcut of reordered) {
        await shortcutStore.upsert({
          clientId: shortcut.id,
          ...shortcut,
          syncStatus: 'synced',
        });
      }
      return Result.ok(reordered);
    } catch {
      // fall through
    }
  }

  const local = await shortcutStore.listForFile(organizationId, pieceFileId);
  const byId = new Map(local.map((item) => [item.id, item]));
  const now = new Date().toISOString();

  for (let index = 0; index < orderedIds.length; index += 1) {
    const id = orderedIds[index]!;
    const item = byId.get(id);
    if (item) {
      await shortcutStore.upsert({
        ...item,
        sortOrder: index,
        updatedAt: now,
        syncStatus: item.id.startsWith('draft-') ? 'pending' : item.syncStatus,
      });
    }
  }

  await shortcutStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'shortcut_reorder',
    payload: {
      organizationId,
      pieceFileId,
      orderedIds: orderedIds.filter((id) => !id.startsWith('draft-')),
    },
    createdAt: now,
  });

  const updated = await shortcutStore.listForFile(organizationId, pieceFileId);
  return Result.ok(updated.map(toPdfNavigationShortcut));
}

export async function syncPendingNavigationShortcutChanges(
  shortcutRepo: PieceFileNavigationShortcutRepository,
  shortcutStore: OfflineNavigationShortcutStore,
): Promise<{ synced: number; failed: number }> {
  if (!isBrowserOnline()) {
    return { synced: 0, failed: 0 };
  }

  const outbox = await shortcutStore.listOutbox();
  let synced = 0;
  let failed = 0;

  for (const item of outbox) {
    try {
      if (item.op === 'shortcut_create') {
        const payload = item.payload as {
          clientId: string;
          organizationId: string;
          authorUserId: string;
          input: CreatePdfNavigationShortcutInput;
        };
        const created = await shortcutRepo.create(
          payload.organizationId,
          payload.authorUserId,
          payload.input,
        );
        await shortcutStore.replaceClientId(
          payload.clientId,
          created.id,
          created.updatedAt,
        );
        await shortcutStore.removeOutbox(item.id);
        synced += 1;
      } else if (item.op === 'shortcut_update') {
        const payload = item.payload as {
          organizationId: string;
          pieceFileId: string;
          shortcutId: string;
          input: UpdatePdfNavigationShortcutInput;
        };
        const updated = await shortcutRepo.update(
          payload.organizationId,
          payload.pieceFileId,
          payload.shortcutId,
          payload.input,
        );
        if (updated) {
          await shortcutStore.upsert({
            clientId: updated.id,
            ...updated,
            syncStatus: 'synced',
          });
          await shortcutStore.removeOutbox(item.id);
          synced += 1;
        } else {
          failed += 1;
        }
      } else if (item.op === 'shortcut_delete') {
        const payload = item.payload as {
          organizationId: string;
          pieceFileId: string;
          shortcutId: string;
        };
        await shortcutRepo.remove(
          payload.organizationId,
          payload.pieceFileId,
          payload.shortcutId,
        );
        await shortcutStore.removeOutbox(item.id);
        synced += 1;
      } else if (item.op === 'shortcut_reorder') {
        const payload = item.payload as {
          organizationId: string;
          pieceFileId: string;
          orderedIds: string[];
        };
        if (payload.orderedIds.length > 0) {
          await shortcutRepo.reorder(
            payload.organizationId,
            payload.pieceFileId,
            payload.orderedIds,
          );
        }
        await shortcutStore.removeOutbox(item.id);
        synced += 1;
      }
    } catch {
      await shortcutStore.incrementOutboxRetry(item.id);
      failed += 1;
    }
  }

  return { synced, failed };
}
