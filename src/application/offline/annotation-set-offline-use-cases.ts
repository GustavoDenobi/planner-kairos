import type { AnnotationSetRepository } from '@/application/ports/annotation-set-repository';
import type {
  AnnotationViewerContext,
  LocalAnnotationSet,
  OfflineAnnotationStore,
} from '@/application/ports/offline-annotation-store';
import type { AnnotationSet, CreateAnnotationSetInput, UpdateAnnotationSetInput, AnnotationSetAudienceLookup } from '@/domain/repertoire';
import { resolveAnnotationSetAudience } from '@/domain/repertoire';
import { Result } from '@/domain/shared';
import { getOfflineDb } from '@/infrastructure/pwa/db';
import { isBrowserOnline } from './file-cache-use-cases';
import { isPermanentSyncAuthError, resolveSyncAuthorUserId } from './sync-auth';

export function isAnnotationSetVisibleToViewer(
  set: Pick<LocalAnnotationSet, 'authorUserId' | 'groups' | 'musicians'>,
  viewer: AnnotationViewerContext,
): boolean {
  if (set.authorUserId === viewer.userId) {
    return true;
  }

  if (
    viewer.myMusicianId &&
    set.musicians.some((musician) => musician.id === viewer.myMusicianId)
  ) {
    return true;
  }

  const memberGroups = new Set(viewer.memberGroupIds);
  return set.groups.some((group) => memberGroups.has(group.id));
}

function toAnnotationSet(local: LocalAnnotationSet): AnnotationSet {
  return {
    id: local.id,
    organizationId: local.organizationId,
    pieceFileId: local.pieceFileId,
    authorUserId: local.authorUserId,
    title: local.title,
    groups: local.groups,
    musicians: local.musicians,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  };
}

function toLocalSet(set: AnnotationSet, syncStatus: LocalAnnotationSet['syncStatus']): LocalAnnotationSet {
  return {
    id: set.id,
    organizationId: set.organizationId,
    pieceFileId: set.pieceFileId,
    authorUserId: set.authorUserId,
    title: set.title,
    groups: set.groups,
    musicians: set.musicians,
    createdAt: set.createdAt,
    updatedAt: set.updatedAt,
    syncStatus,
  };
}

async function findCachedSetById(
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  setId: string,
): Promise<LocalAnnotationSet | null> {
  const outbox = await annotationStore.listOutbox();
  for (const item of outbox) {
    if (item.op === 'create_annotation_set' && 'clientId' in item.payload && item.payload.clientId === setId) {
      const payload = item.payload as import('@/application/ports/offline-annotation-store').SyncOutboxCreateSetPayload;
      return {
        id: payload.clientId,
        organizationId: payload.organizationId,
        pieceFileId: payload.input.pieceFileId,
        authorUserId: payload.authorUserId,
        title: payload.input.title?.trim() || null,
        groups: [],
        musicians: [],
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
        syncStatus: 'pending',
      };
    }
  }

  const record = await getOfflineDb().cachedAnnotationSets.get(setId);
  if (!record || record.organizationId !== organizationId) {
    return null;
  }

  const audience = JSON.parse(record.audienceJson) as {
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

export async function listAnnotationSetsForReading(
  setRepo: AnnotationSetRepository,
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  pieceFileId: string,
  viewer?: AnnotationViewerContext,
): Promise<Result<AnnotationSet[], string>> {
  if (isBrowserOnline()) {
    try {
      const serverSets = await setRepo.listForFile(organizationId, pieceFileId);
      for (const set of serverSets) {
        await annotationStore.upsertSet(toLocalSet(set, 'synced'));
      }
    } catch {
      /* Keep locally cached sets when the server cannot be reached. */
    }
  }

  const localSets = await annotationStore.listSetsForFile(organizationId, pieceFileId);
  const filtered = viewer
    ? localSets.filter((set) => isAnnotationSetVisibleToViewer(set, viewer))
    : localSets;

  return Result.ok(filtered.map(toAnnotationSet));
}

export async function createAnnotationSetWithOffline(
  setRepo: AnnotationSetRepository,
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  pieceId: string,
  authorUserId: string,
  input: CreateAnnotationSetInput,
  audienceLookup?: AnnotationSetAudienceLookup,
): Promise<Result<AnnotationSet, string>> {
  const clientId = `draft-set-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  if (isBrowserOnline()) {
    try {
      const created = await setRepo.create(organizationId, authorUserId, input);
      const resolved = resolveAnnotationSetAudience(created, audienceLookup);
      await annotationStore.upsertSet(toLocalSet(resolved, 'synced'));
      return Result.ok(resolved);
    } catch (error) {
      if (isPermanentSyncAuthError(error)) {
        return Result.fail('not_allowed');
      }
      // fall through to offline queue
    }
  }

  const draftSet = resolveAnnotationSetAudience(
    {
      id: clientId,
      organizationId,
      pieceFileId: input.pieceFileId,
      authorUserId,
      title: input.title?.trim() || null,
      groups: input.groupIds.map((id) => ({
        id,
        name: audienceLookup?.groups.find((group) => group.id === id)?.name ?? id,
        kind: audienceLookup?.groups.find((group) => group.id === id)?.kind ?? 'class',
      })),
      musicians: input.musicianIds.map((id) => ({
        id,
        fullName: audienceLookup?.musicians.find((musician) => musician.id === id)?.name ?? id,
      })),
      createdAt: now,
      updatedAt: now,
    },
    audienceLookup,
  );

  const localSet: LocalAnnotationSet = {
    ...draftSet,
    syncStatus: 'pending',
  };

  await annotationStore.upsertSet(localSet);
  await annotationStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'create_annotation_set',
    payload: {
      clientId,
      organizationId,
      pieceId,
      authorUserId,
      input,
    },
    createdAt: now,
  });

  return Result.ok(toAnnotationSet(localSet));
}

export async function updateAnnotationSetWithOffline(
  setRepo: AnnotationSetRepository,
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  setId: string,
  input: UpdateAnnotationSetInput,
): Promise<Result<AnnotationSet, string>> {
  if (isBrowserOnline()) {
    try {
      const updated = await setRepo.update(organizationId, setId, input);
      if (!updated) {
        return Result.fail('not_found');
      }
      await annotationStore.upsertSet(toLocalSet(updated, 'synced'));
      return Result.ok(updated);
    } catch {
      // fall through
    }
  }

  const cachedSet = await findCachedSetById(annotationStore, organizationId, setId);
  if (!cachedSet) {
    return Result.fail('not_found');
  }

  const now = new Date().toISOString();
  const nextSet: LocalAnnotationSet = {
    ...cachedSet,
    title: input.title !== undefined ? (input.title?.trim() || null) : cachedSet.title,
    updatedAt: now,
    syncStatus: 'pending',
  };

  await annotationStore.upsertSet(nextSet);
  await annotationStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'update_annotation_set',
    payload: {
      organizationId,
      setId,
      input,
    },
    createdAt: now,
  });

  return Result.ok(toAnnotationSet(nextSet));
}

export async function deleteAnnotationSetWithOffline(
  setRepo: AnnotationSetRepository,
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  pieceFileId: string,
  setId: string,
): Promise<Result<void, string>> {
  const isDraft = setId.startsWith('draft-set-');

  if (isDraft) {
    await annotationStore.removeSet(organizationId, pieceFileId, setId);
    const outbox = await annotationStore.listOutbox();
    for (const item of outbox) {
      if (item.op === 'create_annotation_set' && 'clientId' in item.payload && item.payload.clientId === setId) {
        await annotationStore.removeOutbox(item.id);
      }
    }
    return Result.ok(undefined);
  }

  if (isBrowserOnline()) {
    const removed = await setRepo.remove(organizationId, setId);
    if (removed) {
      await annotationStore.removeSet(organizationId, pieceFileId, setId);
      return Result.ok(undefined);
    }
  }

  const now = new Date().toISOString();
  await annotationStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'delete_annotation_set',
    payload: {
      organizationId,
      pieceFileId,
      setId,
    },
    createdAt: now,
  });
  await annotationStore.removeSet(organizationId, pieceFileId, setId);

  return Result.ok(undefined);
}

export async function syncPendingAnnotationSetChanges(
  setRepo: AnnotationSetRepository,
  annotationStore: OfflineAnnotationStore,
  currentUserId?: string | null,
): Promise<{ synced: number; failed: number }> {
  if (!isBrowserOnline() || !currentUserId) {
    return { synced: 0, failed: 0 };
  }

  const outbox = await annotationStore.listOutbox();
  let synced = 0;
  let failed = 0;

  for (const item of outbox) {
    try {
      if (item.op === 'create_annotation_set') {
        const payload = item.payload as import('@/application/ports/offline-annotation-store').SyncOutboxCreateSetPayload;
        const authorUserId = resolveSyncAuthorUserId(currentUserId, payload.authorUserId);
        if (!authorUserId) {
          continue;
        }
        const created = await setRepo.create(
          payload.organizationId,
          authorUserId,
          payload.input,
        );
        await annotationStore.replaceSetId(payload.clientId, toLocalSet(created, 'synced'));
        await annotationStore.removeOutbox(item.id);
        synced += 1;
      } else if (item.op === 'update_annotation_set') {
        const payload = item.payload as import('@/application/ports/offline-annotation-store').SyncOutboxUpdateSetPayload;
        const updated = await setRepo.update(payload.organizationId, payload.setId, payload.input);
        if (!updated) {
          throw new Error('update_failed');
        }
        await annotationStore.upsertSet(toLocalSet(updated, 'synced'));
        await annotationStore.removeOutbox(item.id);
        synced += 1;
      } else if (item.op === 'delete_annotation_set') {
        const payload = item.payload as import('@/application/ports/offline-annotation-store').SyncOutboxDeleteSetPayload;
        await setRepo.remove(payload.organizationId, payload.setId);
        await annotationStore.removeOutbox(item.id);
        synced += 1;
      }
    } catch (error) {
      if (isPermanentSyncAuthError(error)) {
        await annotationStore.removeOutbox(item.id);
      } else {
        await annotationStore.incrementOutboxRetry(item.id);
      }
      failed += 1;
    }
  }

  return { synced, failed };
}

export function visibleDirectedSetIds(
  sets: LocalAnnotationSet[],
  viewer?: AnnotationViewerContext,
): Set<string> {
  if (!viewer) {
    return new Set(sets.map((set) => set.id));
  }
  return new Set(
    sets.filter((set) => isAnnotationSetVisibleToViewer(set, viewer)).map((set) => set.id),
  );
}

export async function repairDirectedAnnotationSetReferences(
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  pieceFileId: string,
  sets: LocalAnnotationSet[],
): Promise<void> {
  const setIds = new Set(sets.map((set) => set.id));
  const localAnnotations = await annotationStore.listForFile(organizationId, pieceFileId);
  const now = new Date().toISOString();

  for (const annotation of localAnnotations) {
    if (annotation.layer !== 'directed' || !annotation.annotationSetId) {
      continue;
    }

    if (setIds.has(annotation.annotationSetId)) {
      continue;
    }

    if (!annotation.annotationSetId.startsWith('draft-set-')) {
      continue;
    }

    const authorSets = sets.filter((set) => set.authorUserId === annotation.authorUserId);
    if (authorSets.length !== 1) {
      continue;
    }

    await annotationStore.upsert({
      ...annotation,
      annotationSetId: authorSets[0]!.id,
      updatedAt: now,
    });
  }
}
