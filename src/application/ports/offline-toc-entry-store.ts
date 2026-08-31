import type {
  CreatePieceFileTocEntryInput,
  PieceFileTocEntry,
  UpdatePieceFileTocEntryInput,
} from '@/domain/repertoire';

export type TocEntrySyncStatus = 'synced' | 'pending' | 'deleted_pending';

export type LocalPieceFileTocEntry = PieceFileTocEntry & {
  clientId: string;
  syncStatus: TocEntrySyncStatus;
};

export type SyncOutboxTocCreatePayload = {
  clientId: string;
  organizationId: string;
  pieceId: string;
  input: CreatePieceFileTocEntryInput;
};

export type SyncOutboxTocUpdatePayload = {
  organizationId: string;
  pieceFileId: string;
  entryId: string;
  input: UpdatePieceFileTocEntryInput;
};

export type SyncOutboxTocDeletePayload = {
  organizationId: string;
  pieceFileId: string;
  entryId: string;
};

export type SyncOutboxTocReorderPayload = {
  organizationId: string;
  pieceFileId: string;
  orderedIds: string[];
};

export type TocEntrySyncOutboxItem = {
  id: string;
  op: 'toc_create' | 'toc_update' | 'toc_delete' | 'toc_reorder';
  payload:
    | SyncOutboxTocCreatePayload
    | SyncOutboxTocUpdatePayload
    | SyncOutboxTocDeletePayload
    | SyncOutboxTocReorderPayload;
  createdAt: string;
  retryCount: number;
};

export type OfflineTocEntryStore = {
  listForFile(organizationId: string, pieceFileId: string): Promise<LocalPieceFileTocEntry[]>;
  upsert(entry: LocalPieceFileTocEntry): Promise<void>;
  removeLocal(organizationId: string, pieceFileId: string, clientId: string): Promise<void>;
  replaceClientId(clientId: string, serverId: string, updatedAt: string): Promise<void>;
  listPendingForFile(
    organizationId: string,
    pieceFileId: string,
  ): Promise<LocalPieceFileTocEntry[]>;
  enqueueOutbox(item: Omit<TocEntrySyncOutboxItem, 'retryCount'>): Promise<void>;
  listOutbox(): Promise<TocEntrySyncOutboxItem[]>;
  removeOutbox(id: string): Promise<void>;
  incrementOutboxRetry(id: string): Promise<void>;
  clearAll(): Promise<void>;
};
