import type {
  AnnotationGeometry,
  AnnotationLayer,
  AnnotationSet,
  AnnotationType,
  CreateAnnotationSetInput,
  CreatePdfAnnotationInput,
  UpdateAnnotationSetInput,
} from '@/domain/repertoire';

export type AnnotationSyncStatus = 'synced' | 'pending' | 'deleted_pending';

export type LocalPdfAnnotation = {
  clientId: string;
  id: string;
  organizationId: string;
  pieceFileId: string;
  pageNumber: number;
  layer: AnnotationLayer;
  type: AnnotationType;
  geometry: AnnotationGeometry;
  color: string;
  authorUserId: string;
  sectionId: string | null;
  annotationSetId: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: AnnotationSyncStatus;
};

export type LocalAnnotationSet = {
  id: string;
  organizationId: string;
  pieceFileId: string;
  authorUserId: string;
  title: string | null;
  groups: AnnotationSet['groups'];
  musicians: AnnotationSet['musicians'];
  createdAt: string;
  updatedAt: string;
  syncStatus: AnnotationSyncStatus;
};

export type AnnotationViewerContext = {
  userId: string;
  myMusicianId: string | null;
  memberGroupIds: string[];
};

export type SyncOutboxCreatePayload = {
  clientId: string;
  organizationId: string;
  pieceId: string;
  authorUserId: string;
  input: CreatePdfAnnotationInput;
};

export type SyncOutboxDeletePayload = {
  clientId: string;
  organizationId: string;
  pieceFileId: string;
  annotationId: string;
};

export type SyncOutboxCreateSetPayload = {
  clientId: string;
  organizationId: string;
  pieceId: string;
  authorUserId: string;
  input: CreateAnnotationSetInput;
};

export type SyncOutboxUpdateSetPayload = {
  organizationId: string;
  setId: string;
  input: UpdateAnnotationSetInput;
};

export type SyncOutboxDeleteSetPayload = {
  organizationId: string;
  pieceFileId: string;
  setId: string;
};

export type SyncOutboxItem = {
  id: string;
  op: 'create' | 'delete' | 'create_annotation_set' | 'update_annotation_set' | 'delete_annotation_set';
  payload:
    | SyncOutboxCreatePayload
    | SyncOutboxDeletePayload
    | SyncOutboxCreateSetPayload
    | SyncOutboxUpdateSetPayload
    | SyncOutboxDeleteSetPayload;
  createdAt: string;
  retryCount: number;
};

export type OfflineAnnotationStore = {
  listForFile(organizationId: string, pieceFileId: string): Promise<LocalPdfAnnotation[]>;
  upsert(annotation: LocalPdfAnnotation): Promise<void>;
  removeLocal(organizationId: string, pieceFileId: string, clientId: string): Promise<void>;
  replaceClientId(
    clientId: string,
    serverId: string,
    updatedAt: string,
  ): Promise<void>;
  listPendingForFile(organizationId: string, pieceFileId: string): Promise<LocalPdfAnnotation[]>;
  pendingSyncCount(organizationId: string, pieceFileId?: string): Promise<number>;
  listSetsForFile(organizationId: string, pieceFileId: string): Promise<LocalAnnotationSet[]>;
  upsertSet(set: LocalAnnotationSet): Promise<void>;
  removeSet(organizationId: string, pieceFileId: string, setId: string): Promise<void>;
  replaceSetId(clientId: string, serverSet: LocalAnnotationSet): Promise<void>;
  enqueueOutbox(item: Omit<SyncOutboxItem, 'retryCount'>): Promise<void>;
  listOutbox(): Promise<SyncOutboxItem[]>;
  removeOutbox(id: string): Promise<void>;
  incrementOutboxRetry(id: string): Promise<void>;
  clearAll(): Promise<void>;
};
