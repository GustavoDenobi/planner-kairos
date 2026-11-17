import Dexie, { type Table } from 'dexie';
import type { AnnotationSyncStatus } from '@/application/ports/offline-annotation-store';

export type CachedFileRecord = {
  pieceFileId: string;
  organizationId: string;
  pieceId: string;
  contentHash: string | null;
  byteSize: number | null;
  title: string;
  cachedAt: string;
  blob: Blob;
};

export type CachedAnnotationRecord = {
  clientId: string;
  id: string;
  organizationId: string;
  pieceFileId: string;
  pageNumber: number;
  layer: 'personal' | 'section' | 'directed';
  type: 'stroke' | 'highlight' | 'text' | 'cover' | 'note';
  geometryJson: string;
  color: string;
  authorUserId: string;
  sectionId: string | null;
  annotationSetId: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: AnnotationSyncStatus;
};

export type CachedAnnotationSetAudience = {
  groupIds: string[];
  musicianIds: string[];
  groups: Array<{ id: string; name: string; kind: string }>;
  musicians: Array<{ id: string; fullName: string }>;
};

export type CachedAnnotationSetRecord = {
  id: string;
  organizationId: string;
  pieceFileId: string;
  authorUserId: string;
  title: string | null;
  audienceJson: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: AnnotationSyncStatus;
};

export type SyncOutboxRecord = {
  id: string;
  op:
    | 'create'
    | 'update'
    | 'delete'
    | 'create_annotation_set'
    | 'update_annotation_set'
    | 'delete_annotation_set';
  payloadJson: string;
  createdAt: string;
  retryCount: number;
};

export type CachedPlaylistRecord = {
  playlistId: string;
  organizationId: string;
  ownerUserId: string;
  name: string;
  pieceFileIds: string[];
  snapshotJson: string;
  cachedAt: string;
};

export type IdentitySnapshotRecord = {
  id: 'current';
  userId: string;
  email: string;
  organizationsJson: string;
  currentOrgSlug: string | null;
  cachedAt: string;
};

export type CachedAgendaRecord = {
  cacheKey: string;
  organizationId: string;
  userId: string;
  cachedAt: string;
  rangeFrom: string;
  rangeTo: string;
  eventsJson: string;
  eventDetailsJson: string;
  eventTypesJson: string;
  audienceJson: string;
};

export type CachedMusiciansRecord = {
  cacheKey: string;
  organizationId: string;
  userId: string;
  cachedAt: string;
  musiciansJson: string;
  assignmentsJson: string;
  groupsJson: string;
  partsJson: string;
  sectionsJson: string;
  assignmentsByGroupJson?: string;
  sectionPartIdsByGroupJson?: string;
};

export type CachedOrgImageRecord = {
  storageKey: string;
  cachedAt: string;
  blob: Blob;
};

export type CachedNavigationShortcutRecord = {
  clientId: string;
  id: string;
  organizationId: string;
  pieceFileId: string;
  label: string;
  color: string;
  sortOrder: number;
  targetPageNumber: number;
  targetX: number | null;
  targetY: number | null;
  anchorPageNumber: number | null;
  anchorX: number | null;
  anchorY: number | null;
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: import('@/application/ports/offline-navigation-shortcut-store').NavigationShortcutSyncStatus;
};

export type NavigationShortcutSyncOutboxRecord = {
  id: string;
  op: 'shortcut_create' | 'shortcut_update' | 'shortcut_delete' | 'shortcut_reorder';
  payloadJson: string;
  createdAt: string;
  retryCount: number;
};

export type TocEntrySyncOutboxRecord = {
  id: string;
  op: 'toc_create' | 'toc_update' | 'toc_delete' | 'toc_reorder';
  payloadJson: string;
  createdAt: string;
  retryCount: number;
};

export type CachedTocEntryRecord = {
  clientId: string;
  id: string;
  organizationId: string;
  pieceFileId: string;
  label: string;
  sortOrder: number;
  targetPageNumber: number;
  targetX: number | null;
  targetY: number | null;
  endPageNumber: number | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: import('@/application/ports/offline-toc-entry-store').TocEntrySyncStatus;
};

export type StudyRecordingRecord = {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  createdAt: string;
  durationMs: number;
  mimeType: string;
  byteSize: number;
  blob: Blob;
  /** Obra em que a gravação começou (gravações do leitor de partituras). */
  pieceId?: string | null;
  /** Arquivo em que a gravação começou. */
  pieceFileId?: string | null;
  /** Página em que a gravação começou. */
  startPage?: number | null;
  /** Páginas exibidas durante a gravação, com o instante (em segundos de áudio). */
  pageMarks?: StudyRecordingPageMark[];
  /** Recuperada de uma sessão interrompida (aba fechada, travamento). */
  recovered?: boolean;
  /** Tarefa em que a gravação foi feita: só essas podem ser enviadas a ela. */
  practiceTaskId?: string | null;
  /** Título da tarefa no momento da gravação (exibido em Ferramentas). */
  practiceTaskTitle?: string | null;
  /** Envio criado com esta gravação (some da lista de "para enviar"). */
  practiceSubmissionId?: string | null;
};

export type StudyRecordingPageMark = {
  atSec: number;
  pieceFileId: string;
  page: number;
};

/** Sessão de gravação em andamento, persistida para recuperação após interrupção. */
export type StudyRecordingDraftRecord = {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  mimeType: string;
  startedAt: string;
  updatedAt: string;
  durationMs: number;
  pieceId: string | null;
  pieceFileId: string | null;
  startPage: number | null;
  pageMarks: StudyRecordingPageMark[];
  /** Tarefa em que a gravação foi feita: só essas podem ser enviadas a ela. */
  practiceTaskId?: string | null;
  /** Título da tarefa no momento da gravação (exibido em Ferramentas). */
  practiceTaskTitle?: string | null;
};

export type StudyRecordingDraftChunkRecord = {
  draftId: string;
  seq: number;
  blob: Blob;
};

export class PlannerKairosOfflineDb extends Dexie {
  cachedFiles!: Table<CachedFileRecord, string>;
  cachedAnnotations!: Table<CachedAnnotationRecord, string>;
  cachedAnnotationSets!: Table<CachedAnnotationSetRecord, string>;
  syncOutbox!: Table<SyncOutboxRecord, string>;
  cachedPlaylists!: Table<CachedPlaylistRecord, string>;
  identitySnapshot!: Table<IdentitySnapshotRecord, string>;
  cachedAgenda!: Table<CachedAgendaRecord, string>;
  cachedMusicians!: Table<CachedMusiciansRecord, string>;
  cachedOrgImages!: Table<CachedOrgImageRecord, string>;
  cachedNavigationShortcuts!: Table<CachedNavigationShortcutRecord, string>;
  navigationShortcutSyncOutbox!: Table<NavigationShortcutSyncOutboxRecord, string>;
  cachedTocEntries!: Table<CachedTocEntryRecord, string>;
  tocEntrySyncOutbox!: Table<TocEntrySyncOutboxRecord, string>;
  studyRecordings!: Table<StudyRecordingRecord, string>;
  studyRecordingDrafts!: Table<StudyRecordingDraftRecord, string>;
  studyRecordingDraftChunks!: Table<StudyRecordingDraftChunkRecord, [string, number]>;

  constructor() {
    super('planner-kairos-offline');
    this.version(1).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
    });
    this.version(2).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
    });
    this.version(3).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
      cachedAgenda: 'cacheKey, organizationId, userId, [organizationId+userId]',
    });
    this.version(4).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
      cachedAgenda: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedMusicians: 'cacheKey, organizationId, userId, [organizationId+userId]',
    });
    this.version(5).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
      cachedAgenda: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedMusicians: 'cacheKey, organizationId, userId, [organizationId+userId]',
    });
    this.version(6).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
      cachedAgenda: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedMusicians: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedNavigationShortcuts:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      navigationShortcutSyncOutbox: 'id, createdAt',
    });
    this.version(7).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
      cachedAgenda: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedMusicians: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedOrgImages: 'storageKey',
      cachedNavigationShortcuts:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      navigationShortcutSyncOutbox: 'id, createdAt',
    });
    this.version(8).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, annotationSetId, [organizationId+pieceFileId]',
      cachedAnnotationSets:
        'id, pieceFileId, organizationId, syncStatus, authorUserId, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
      cachedAgenda: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedMusicians: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedOrgImages: 'storageKey',
      cachedNavigationShortcuts:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      navigationShortcutSyncOutbox: 'id, createdAt',
    });
    this.version(9).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, annotationSetId, [organizationId+pieceFileId]',
      cachedAnnotationSets:
        'id, pieceFileId, organizationId, syncStatus, authorUserId, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
      cachedAgenda: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedMusicians: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedOrgImages: 'storageKey',
      cachedNavigationShortcuts:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      navigationShortcutSyncOutbox: 'id, createdAt',
      cachedTocEntries:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      tocEntrySyncOutbox: 'id, createdAt',
    });
    this.version(10).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, annotationSetId, [organizationId+pieceFileId]',
      cachedAnnotationSets:
        'id, pieceFileId, organizationId, syncStatus, authorUserId, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
      cachedAgenda: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedMusicians: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedOrgImages: 'storageKey',
      cachedNavigationShortcuts:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      navigationShortcutSyncOutbox: 'id, createdAt',
      cachedTocEntries:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      tocEntrySyncOutbox: 'id, createdAt',
      studyRecordings: 'id, organizationId, userId, createdAt, [organizationId+userId]',
    });
    this.version(11).stores({
      cachedFiles: 'pieceFileId, organizationId, [organizationId+pieceFileId]',
      cachedAnnotations:
        'clientId, pieceFileId, organizationId, syncStatus, annotationSetId, [organizationId+pieceFileId]',
      cachedAnnotationSets:
        'id, pieceFileId, organizationId, syncStatus, authorUserId, [organizationId+pieceFileId]',
      syncOutbox: 'id, createdAt',
      cachedPlaylists: 'playlistId, organizationId',
      identitySnapshot: 'id, userId',
      cachedAgenda: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedMusicians: 'cacheKey, organizationId, userId, [organizationId+userId]',
      cachedOrgImages: 'storageKey',
      cachedNavigationShortcuts:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      navigationShortcutSyncOutbox: 'id, createdAt',
      cachedTocEntries:
        'clientId, pieceFileId, organizationId, syncStatus, [organizationId+pieceFileId]',
      tocEntrySyncOutbox: 'id, createdAt',
      studyRecordings:
        'id, organizationId, userId, createdAt, pieceFileId, [organizationId+userId]',
      studyRecordingDrafts: 'id, userId, updatedAt',
      studyRecordingDraftChunks: '[draftId+seq], draftId',
    });
  }
}

let dbInstance: PlannerKairosOfflineDb | null = null;

export function getOfflineDb(): PlannerKairosOfflineDb {
  if (!dbInstance) {
    dbInstance = new PlannerKairosOfflineDb();
  }
  return dbInstance;
}
