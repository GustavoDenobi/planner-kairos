import type {
  AnnotationViewerContext,
  OfflineAnnotationStore,
} from '@/application/ports/offline-annotation-store';
import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import type {
  CreatePdfAnnotationInput,
  PdfAnnotation,
  UpdatePdfAnnotationInput,
} from '@/domain/repertoire';
import { Result } from '@/domain/shared';
import { isBrowserOnline } from './file-cache-use-cases';
import { isPermanentSyncAuthError } from './sync-auth';
import { visibleDirectedSetIds, repairDirectedAnnotationSetReferences } from './annotation-set-offline-use-cases';

function toPdfAnnotation(local: {
  id: string;
  organizationId: string;
  pieceFileId: string;
  pageNumber: number;
  layer: PdfAnnotation['layer'];
  type: PdfAnnotation['type'];
  geometry: PdfAnnotation['geometry'];
  color: string;
  authorUserId: string;
  sectionId: string | null;
  annotationSetId: string | null;
  createdAt: string;
  updatedAt: string;
}): PdfAnnotation {
  return {
    id: local.id,
    organizationId: local.organizationId,
    pieceFileId: local.pieceFileId,
    pageNumber: local.pageNumber,
    layer: local.layer,
    type: local.type,
    geometry: local.geometry,
    color: local.color,
    authorUserId: local.authorUserId,
    sectionId: local.sectionId,
    annotationSetId: local.annotationSetId,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
  };
}

function isAnnotationVisible(
  annotation: PdfAnnotation,
  visibleSetIds: Set<string>,
  viewer?: AnnotationViewerContext,
): boolean {
  if (annotation.layer === 'personal') {
    return viewer ? annotation.authorUserId === viewer.userId : true;
  }
  if (annotation.layer === 'section') {
    return true;
  }
  if (annotation.layer === 'directed') {
    return annotation.annotationSetId ? visibleSetIds.has(annotation.annotationSetId) : false;
  }
  return true;
}

export async function listAnnotationsForReading(
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  pieceFileId: string,
  viewer?: AnnotationViewerContext,
): Promise<Result<PdfAnnotation[], string>> {
  if (isBrowserOnline()) {
    try {
      const serverAnnotations = await annotationRepo.listForFile(organizationId, pieceFileId);
      for (const annotation of serverAnnotations) {
        await annotationStore.upsert({
          clientId: annotation.id,
          id: annotation.id,
          organizationId: annotation.organizationId,
          pieceFileId: annotation.pieceFileId,
          pageNumber: annotation.pageNumber,
          layer: annotation.layer,
          type: annotation.type,
          geometry: annotation.geometry,
          color: annotation.color,
          authorUserId: annotation.authorUserId,
          sectionId: annotation.sectionId,
          annotationSetId: annotation.annotationSetId,
          createdAt: annotation.createdAt,
          updatedAt: annotation.updatedAt,
          syncStatus: 'synced',
        });
      }
    } catch {
      /* Keep locally cached annotations when the server cannot be reached. */
    }
  }

  const localSets = await annotationStore.listSetsForFile(organizationId, pieceFileId);
  await repairDirectedAnnotationSetReferences(
    annotationStore,
    organizationId,
    pieceFileId,
    localSets,
  );
  const visibleSetIds = visibleDirectedSetIds(localSets, viewer);
  const local = await annotationStore.listForFile(organizationId, pieceFileId);
  const pending = await annotationStore.listPendingForFile(organizationId, pieceFileId);

  const tombstoneIds = new Set(
    (await annotationStore.listOutbox())
      .filter((item) => item.op === 'delete')
      .map((item) => {
        const payload = item.payload as { annotationId: string; pieceFileId: string };
        return payload.pieceFileId === pieceFileId ? payload.annotationId : null;
      })
      .filter((id): id is string => Boolean(id)),
  );

  const merged = new Map<string, PdfAnnotation>();
  for (const item of local) {
    if (!tombstoneIds.has(item.id)) {
      const annotation = toPdfAnnotation(item);
      if (isAnnotationVisible(annotation, visibleSetIds, viewer)) {
        merged.set(item.clientId, annotation);
      }
    }
  }
  for (const item of pending) {
    const annotation = toPdfAnnotation(item);
    if (isAnnotationVisible(annotation, visibleSetIds, viewer)) {
      merged.set(item.clientId, annotation);
    }
  }

  return Result.ok(Array.from(merged.values()));
}

export async function createAnnotationWithOffline(
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  pieceId: string,
  authorUserId: string,
  input: CreatePdfAnnotationInput,
): Promise<Result<PdfAnnotation, string>> {
  const clientId = `draft-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const localAnnotation = {
    clientId,
    id: clientId,
    organizationId,
    pieceFileId: input.pieceFileId,
    pageNumber: input.pageNumber,
    layer: input.layer,
    type: input.type,
    geometry: input.geometry,
    color: input.color,
    authorUserId,
    sectionId: input.sectionId ?? null,
    annotationSetId: input.annotationSetId ?? null,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending' as const,
  };

  if (isBrowserOnline()) {
    try {
      const created = await annotationRepo.create(organizationId, authorUserId, input);
      await annotationStore.upsert({
        ...localAnnotation,
        clientId: created.id,
        id: created.id,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        syncStatus: 'synced',
      });
      return Result.ok(created);
    } catch (error) {
      if (isPermanentSyncAuthError(error)) {
        return Result.fail('not_allowed');
      }
      // fall through to offline queue
    }
  }

  await annotationStore.upsert(localAnnotation);
  await annotationStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'create',
    payload: {
      clientId,
      organizationId,
      pieceId,
      authorUserId,
      input,
    },
    createdAt: now,
  });

  return Result.ok(toPdfAnnotation(localAnnotation));
}

export async function deleteAnnotationWithOffline(
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  pieceFileId: string,
  annotationId: string,
): Promise<Result<void, string>> {
  const isDraft = annotationId.startsWith('draft-');

  if (isDraft) {
    await annotationStore.removeLocal(organizationId, pieceFileId, annotationId);
    const outbox = await annotationStore.listOutbox();
    for (const item of outbox) {
      if (item.op === 'create' && 'clientId' in item.payload && item.payload.clientId === annotationId) {
        await annotationStore.removeOutbox(item.id);
      }
    }
    return Result.ok(undefined);
  }

  if (isBrowserOnline()) {
    const removed = await annotationRepo.remove(organizationId, pieceFileId, annotationId);
    if (removed) {
      await annotationStore.removeLocal(organizationId, pieceFileId, annotationId);
      return Result.ok(undefined);
    }
  }

  const now = new Date().toISOString();
  await annotationStore.enqueueOutbox({
    id: crypto.randomUUID(),
    op: 'delete',
    payload: {
      clientId: annotationId,
      organizationId,
      pieceFileId,
      annotationId,
    },
    createdAt: now,
  });
  await annotationStore.removeLocal(organizationId, pieceFileId, annotationId);

  return Result.ok(undefined);
}

export async function updateAnnotationWithOffline(
  annotationRepo: PieceFileAnnotationRepository,
  annotationStore: OfflineAnnotationStore,
  organizationId: string,
  pieceFileId: string,
  annotationId: string,
  input: UpdatePdfAnnotationInput,
): Promise<Result<PdfAnnotation, string>> {
  if (!isBrowserOnline()) {
    return Result.fail('offline');
  }

  const updated = await annotationRepo.update(organizationId, pieceFileId, annotationId, input);
  if (!updated) {
    return Result.fail('not_found');
  }

  await annotationStore.upsert({
    clientId: updated.id,
    id: updated.id,
    organizationId: updated.organizationId,
    pieceFileId: updated.pieceFileId,
    pageNumber: updated.pageNumber,
    layer: updated.layer,
    type: updated.type,
    geometry: updated.geometry,
    color: updated.color,
    authorUserId: updated.authorUserId,
    sectionId: updated.sectionId,
    annotationSetId: updated.annotationSetId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    syncStatus: 'synced',
  });

  return Result.ok(updated);
}
