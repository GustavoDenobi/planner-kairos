import type {
  AnnotationGeometry,
  AnnotationLayer,
  AnnotationType,
  CreatePdfAnnotationInput,
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
  createdAt: string;
  updatedAt: string;
  syncStatus: AnnotationSyncStatus;
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

export type SyncOutboxItem = {
  id: string;
  op: 'create' | 'delete';
  payload: SyncOutboxCreatePayload | SyncOutboxDeletePayload;
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
  enqueueOutbox(item: Omit<SyncOutboxItem, 'retryCount'>): Promise<void>;
  listOutbox(): Promise<SyncOutboxItem[]>;
  removeOutbox(id: string): Promise<void>;
  incrementOutboxRetry(id: string): Promise<void>;
  clearAll(): Promise<void>;
};
