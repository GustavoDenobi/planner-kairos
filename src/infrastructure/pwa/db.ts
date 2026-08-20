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
  layer: 'personal' | 'section';
  type: 'stroke' | 'highlight';
  geometryJson: string;
  color: string;
  authorUserId: string;
  sectionId: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: AnnotationSyncStatus;
};

export type SyncOutboxRecord = {
  id: string;
  op: 'create' | 'delete';
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
};

export class PlannerKairosOfflineDb extends Dexie {
  cachedFiles!: Table<CachedFileRecord, string>;
  cachedAnnotations!: Table<CachedAnnotationRecord, string>;
  syncOutbox!: Table<SyncOutboxRecord, string>;
  cachedPlaylists!: Table<CachedPlaylistRecord, string>;
  identitySnapshot!: Table<IdentitySnapshotRecord, string>;
  cachedAgenda!: Table<CachedAgendaRecord, string>;
  cachedMusicians!: Table<CachedMusiciansRecord, string>;

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
  }
}

let dbInstance: PlannerKairosOfflineDb | null = null;

export function getOfflineDb(): PlannerKairosOfflineDb {
  if (!dbInstance) {
    dbInstance = new PlannerKairosOfflineDb();
  }
  return dbInstance;
}
