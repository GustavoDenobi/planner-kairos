import type { StudyRecordingRecord } from '@/infrastructure/pwa/db';
import { getOfflineDb } from '@/infrastructure/pwa/db';

export type StudyRecordingInput = {
  organizationId: string;
  userId: string;
  title: string;
  durationMs: number;
  mimeType: string;
  blob: Blob;
};

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
    createdAt: new Date().toISOString(),
    durationMs: input.durationMs,
    mimeType: input.mimeType,
    byteSize: input.blob.size,
    blob: input.blob,
  };

  await getOfflineDb().studyRecordings.put(record);
  return record;
}

export async function deleteStudyRecording(id: string): Promise<void> {
  await getOfflineDb().studyRecordings.delete(id);
}

export async function getStudyRecording(id: string): Promise<StudyRecordingRecord | undefined> {
  return getOfflineDb().studyRecordings.get(id);
}
