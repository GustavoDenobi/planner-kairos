// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getOfflineDb } from '@/infrastructure/pwa/db';
import {
  appendStudyRecordingDraftChunk,
  createStudyRecordingDraft,
  isStudyRecordingDraftStale,
  listStudyRecordings,
  recoverStaleStudyRecordingDrafts,
  renameStudyRecording,
  addStudyRecording,
  getStudyRecording,
  markStudyRecordingSubmitted,
  STUDY_RECORDING_DRAFT_STALE_MS,
} from '@/infrastructure/pwa/study-recording-store';

const ORG = 'org-1';
const USER = 'user-1';

async function createDraft(id: string, startedAt: string) {
  await createStudyRecordingDraft({
    id,
    organizationId: ORG,
    userId: USER,
    title: 'Sonata · 03/11 10:00:00',
    mimeType: 'audio/webm',
    startedAt,
    updatedAt: startedAt,
    durationMs: 0,
    pieceId: 'piece-1',
    pieceFileId: 'file-1',
    startPage: 2,
    pageMarks: [{ atSec: 0, pieceFileId: 'file-1', page: 2 }],
  });
}

describe('study-recording-store drafts', () => {
  beforeEach(async () => {
    const db = getOfflineDb();
    await db.studyRecordings.clear();
    await db.studyRecordingDrafts.clear();
    await db.studyRecordingDraftChunks.clear();
  });

  it('considera rascunho abandonado só após o limite', () => {
    const now = Date.parse('2026-11-03T10:00:00.000Z');
    expect(
      isStudyRecordingDraftStale({ updatedAt: new Date(now - 1000).toISOString() }, now),
    ).toBe(false);
    expect(
      isStudyRecordingDraftStale(
        { updatedAt: new Date(now - STUDY_RECORDING_DRAFT_STALE_MS).toISOString() },
        now,
      ),
    ).toBe(true);
  });

  it('recupera rascunho abandonado como gravação, com contexto e marcas de página', async () => {
    await createDraft('draft-1', '2026-11-03T10:00:00.000Z');
    await appendStudyRecordingDraftChunk({
      draftId: 'draft-1',
      seq: 0,
      blob: new Blob(['aa'], { type: 'audio/webm' }),
      durationMs: 5000,
      pageMarks: [{ atSec: 0, pieceFileId: 'file-1', page: 2 }],
    });
    await appendStudyRecordingDraftChunk({
      draftId: 'draft-1',
      seq: 1,
      blob: new Blob(['bbb'], { type: 'audio/webm' }),
      durationMs: 10000,
      pageMarks: [
        { atSec: 0, pieceFileId: 'file-1', page: 2 },
        { atSec: 7, pieceFileId: 'file-1', page: 3 },
      ],
    });

    const now = Date.now() + STUDY_RECORDING_DRAFT_STALE_MS + 1;
    const recovered = await recoverStaleStudyRecordingDrafts(USER, now);

    expect(recovered).toHaveLength(1);
    const [record] = await listStudyRecordings(ORG, USER);
    expect(record).toMatchObject({
      title: 'Sonata · 03/11 10:00:00 (recuperada)',
      durationMs: 10000,
      byteSize: 5,
      pieceId: 'piece-1',
      pieceFileId: 'file-1',
      startPage: 2,
      recovered: true,
      createdAt: '2026-11-03T10:00:00.000Z',
    });
    expect(record?.pageMarks).toHaveLength(2);
    expect(await getOfflineDb().studyRecordingDrafts.count()).toBe(0);
    expect(await getOfflineDb().studyRecordingDraftChunks.count()).toBe(0);
  });

  it('não mexe em rascunho recente (outra aba ainda gravando)', async () => {
    await createDraft('draft-live', new Date().toISOString());
    const recovered = await recoverStaleStudyRecordingDrafts(USER, Date.now());
    expect(recovered).toHaveLength(0);
    expect(await getOfflineDb().studyRecordingDrafts.count()).toBe(1);
  });

  it('descarta rascunho abandonado sem áudio', async () => {
    await createDraft('draft-empty', '2026-11-03T10:00:00.000Z');
    const recovered = await recoverStaleStudyRecordingDrafts(
      USER,
      Date.now() + STUDY_RECORDING_DRAFT_STALE_MS + 1,
    );
    expect(recovered).toHaveLength(0);
    expect(await listStudyRecordings(ORG, USER)).toHaveLength(0);
    expect(await getOfflineDb().studyRecordingDrafts.count()).toBe(0);
  });
});

describe('appendStudyRecordingDraftChunk', () => {
  it('não grava trechos de rascunho inexistente', async () => {
    const db = getOfflineDb();
    await db.studyRecordingDraftChunks.clear();
    await appendStudyRecordingDraftChunk({
      draftId: 'missing',
      seq: 0,
      blob: new Blob(['x']),
      durationMs: 1000,
      pageMarks: [],
    });
    expect(await db.studyRecordingDraftChunks.count()).toBe(0);
  });
});

describe('renameStudyRecording', () => {
  it('apara o nome e recusa nome vazio', async () => {
    const record = await addStudyRecording({
      organizationId: ORG,
      userId: USER,
      title: 'Gravação 03/11 10:00:00',
      durationMs: 1000,
      mimeType: 'audio/webm',
      blob: new Blob(['x'], { type: 'audio/webm' }),
    });

    expect(await renameStudyRecording(record.id, '  Escala de Sol — 2ª tentativa  ')).toBe(
      'Escala de Sol — 2ª tentativa',
    );
    expect((await getStudyRecording(record.id))?.title).toBe('Escala de Sol — 2ª tentativa');

    expect(await renameStudyRecording(record.id, '   ')).toBeNull();
    expect((await getStudyRecording(record.id))?.title).toBe('Escala de Sol — 2ª tentativa');
  });
});

describe('gravações de tarefa', () => {
  beforeEach(async () => {
    const db = getOfflineDb();
    await db.studyRecordings.clear();
    await db.studyRecordingDrafts.clear();
    await db.studyRecordingDraftChunks.clear();
  });

  it('a gravação recuperada continua ligada à tarefa', async () => {
    await createStudyRecordingDraft({
      id: 'draft-task',
      organizationId: ORG,
      userId: USER,
      title: 'Escala · 05/11 10:00:00',
      mimeType: 'audio/webm',
      startedAt: '2026-11-05T10:00:00.000Z',
      updatedAt: '2026-11-05T10:00:00.000Z',
      durationMs: 0,
      pieceId: null,
      pieceFileId: null,
      startPage: null,
      pageMarks: [],
      practiceTaskId: 'task-1',
      practiceTaskTitle: 'Escala de Sol maior',
    });
    await appendStudyRecordingDraftChunk({
      draftId: 'draft-task',
      seq: 0,
      blob: new Blob(['aa'], { type: 'audio/webm' }),
      durationMs: 3000,
      pageMarks: [],
    });

    await recoverStaleStudyRecordingDrafts(USER, Date.now() + STUDY_RECORDING_DRAFT_STALE_MS + 1);

    const [record] = await listStudyRecordings(ORG, USER);
    expect(record).toMatchObject({
      practiceTaskId: 'task-1',
      practiceTaskTitle: 'Escala de Sol maior',
    });
  });

  it('marca a gravação como enviada', async () => {
    const record = await addStudyRecording({
      organizationId: ORG,
      userId: USER,
      title: 'Escala',
      durationMs: 1000,
      mimeType: 'audio/webm',
      blob: new Blob(['a'], { type: 'audio/webm' }),
      practiceTaskId: 'task-1',
      practiceTaskTitle: 'Escala de Sol maior',
    });
    expect(record.practiceSubmissionId).toBeUndefined();

    await markStudyRecordingSubmitted(record.id, 'sub-1');

    expect((await getStudyRecording(record.id))?.practiceSubmissionId).toBe('sub-1');
  });
});
