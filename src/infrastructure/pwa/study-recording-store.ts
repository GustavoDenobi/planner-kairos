import type {
  StudyRecordingDraftRecord,
  StudyRecordingPageMark,
  StudyRecordingRecord,
} from '@/infrastructure/pwa/db';
import { getOfflineDb } from '@/infrastructure/pwa/db';

export type StudyRecordingContext = {
  pieceId: string | null;
  pieceFileId: string | null;
  startPage: number | null;
};

export type StudyRecordingInput = {
  organizationId: string;
  userId: string;
  title: string;
  durationMs: number;
  mimeType: string;
  blob: Blob;
  pieceId?: string | null;
  pieceFileId?: string | null;
  startPage?: number | null;
  pageMarks?: StudyRecordingPageMark[];
  recovered?: boolean;
  createdAt?: string;
  practiceTaskId?: string | null;
  practiceTaskTitle?: string | null;
};

/**
 * Rascunhos sem atualização há mais tempo que isto são considerados abandonados
 * (aba fechada, travamento). Rascunhos mais recentes podem pertencer a outra aba
 * ainda gravando e não devem ser recuperados. A margem cobre o atraso de timers
 * em abas em segundo plano (navegadores chegam a rodá-los uma vez por minuto).
 */
export const STUDY_RECORDING_DRAFT_STALE_MS = 3 * 60_000;

export async function listStudyRecordings(
  organizationId: string,
  userId: string,
): Promise<StudyRecordingRecord[]> {
  const db = getOfflineDb();
  const rows = await db.studyRecordings
    .where('[organizationId+userId]')
    .equals([organizationId, userId])
    .toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addStudyRecording(input: StudyRecordingInput): Promise<StudyRecordingRecord> {
  const record: StudyRecordingRecord = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    userId: input.userId,
    title: input.title,
    createdAt: input.createdAt ?? new Date().toISOString(),
    durationMs: input.durationMs,
    mimeType: input.mimeType,
    byteSize: input.blob.size,
    blob: input.blob,
    pieceId: input.pieceId ?? null,
    pieceFileId: input.pieceFileId ?? null,
    startPage: input.startPage ?? null,
    pageMarks: input.pageMarks ?? [],
    ...(input.recovered ? { recovered: true } : {}),
    practiceTaskId: input.practiceTaskId ?? null,
    practiceTaskTitle: input.practiceTaskTitle ?? null,
  };

  await getOfflineDb().studyRecordings.put(record);
  return record;
}

/** Marca a gravação como enviada à tarefa (deixa de aparecer como pendente de envio). */
export async function markStudyRecordingSubmitted(id: string, submissionId: string): Promise<void> {
  await getOfflineDb().studyRecordings.update(id, { practiceSubmissionId: submissionId });
}

export async function deleteStudyRecording(id: string): Promise<void> {
  await getOfflineDb().studyRecordings.delete(id);
}

export const STUDY_RECORDING_TITLE_MAX_LENGTH = 120;

/** Renomeia uma gravação local. Retorna o título salvo (aparado), ou null se vazio. */
export async function renameStudyRecording(id: string, title: string): Promise<string | null> {
  const trimmed = title.trim().slice(0, STUDY_RECORDING_TITLE_MAX_LENGTH);
  if (!trimmed) {
    return null;
  }
  await getOfflineDb().studyRecordings.update(id, { title: trimmed });
  return trimmed;
}

export async function getStudyRecording(id: string): Promise<StudyRecordingRecord | undefined> {
  return getOfflineDb().studyRecordings.get(id);
}

export async function createStudyRecordingDraft(
  draft: StudyRecordingDraftRecord,
): Promise<void> {
  await getOfflineDb().studyRecordingDrafts.put(draft);
}

/** Acrescenta um trecho de áudio ao rascunho e atualiza duração e marcas de página. */
export async function appendStudyRecordingDraftChunk(input: {
  draftId: string;
  seq: number;
  blob: Blob;
  durationMs: number;
  pageMarks: StudyRecordingPageMark[];
}): Promise<void> {
  const db = getOfflineDb();
  await db.transaction('rw', db.studyRecordingDrafts, db.studyRecordingDraftChunks, async () => {
    // Rascunho já recuperado/descartado: não deixa trechos órfãos.
    if (!(await db.studyRecordingDrafts.get(input.draftId))) {
      return;
    }
    if (input.blob.size > 0) {
      await db.studyRecordingDraftChunks.put({
        draftId: input.draftId,
        seq: input.seq,
        blob: input.blob,
      });
    }
    await db.studyRecordingDrafts.update(input.draftId, {
      durationMs: input.durationMs,
      pageMarks: input.pageMarks,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function deleteStudyRecordingDraft(draftId: string): Promise<void> {
  const db = getOfflineDb();
  await db.transaction('rw', db.studyRecordingDrafts, db.studyRecordingDraftChunks, async () => {
    await db.studyRecordingDraftChunks.where('draftId').equals(draftId).delete();
    await db.studyRecordingDrafts.delete(draftId);
  });
}

export function isStudyRecordingDraftStale(
  draft: Pick<StudyRecordingDraftRecord, 'updatedAt'>,
  now: number = Date.now(),
): boolean {
  const updatedAt = Date.parse(draft.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return true;
  }
  return now - updatedAt >= STUDY_RECORDING_DRAFT_STALE_MS;
}

export function buildRecoveredStudyRecordingTitle(title: string): string {
  return `${title} (recuperada)`;
}

/**
 * Converte em gravações os rascunhos abandonados do usuário (sessões interrompidas).
 * Rascunhos sem áudio são apenas descartados. Retorna as gravações recuperadas.
 */
export async function recoverStaleStudyRecordingDrafts(
  userId: string,
  now: number = Date.now(),
): Promise<StudyRecordingRecord[]> {
  const db = getOfflineDb();
  const drafts = await db.studyRecordingDrafts.where('userId').equals(userId).toArray();
  const recovered: StudyRecordingRecord[] = [];

  for (const draft of drafts) {
    if (!isStudyRecordingDraftStale(draft, now)) {
      continue;
    }

    const chunks = await db.studyRecordingDraftChunks
      .where('draftId')
      .equals(draft.id)
      .sortBy('seq');
    const blob = new Blob(
      chunks.map((chunk) => chunk.blob),
      { type: draft.mimeType },
    );

    if (blob.size > 0) {
      recovered.push(
        await addStudyRecording({
          organizationId: draft.organizationId,
          userId: draft.userId,
          title: buildRecoveredStudyRecordingTitle(draft.title),
          durationMs: draft.durationMs,
          mimeType: draft.mimeType,
          blob,
          pieceId: draft.pieceId,
          pieceFileId: draft.pieceFileId,
          startPage: draft.startPage,
          pageMarks: draft.pageMarks,
          recovered: true,
          createdAt: draft.startedAt,
          practiceTaskId: draft.practiceTaskId ?? null,
          practiceTaskTitle: draft.practiceTaskTitle ?? null,
        }),
      );
    }

    await deleteStudyRecordingDraft(draft.id);
  }

  return recovered;
}

/** Pede ao navegador que não apague o armazenamento local por falta de uso/espaço. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return false;
    }
    if (await navigator.storage.persisted?.()) {
      return true;
    }
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
