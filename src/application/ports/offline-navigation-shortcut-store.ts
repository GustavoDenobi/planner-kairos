import type {
  CreatePdfNavigationShortcutInput,
  PdfNavigationShortcut,
  UpdatePdfNavigationShortcutInput,
} from '@/domain/repertoire';

export type NavigationShortcutSyncStatus = 'synced' | 'pending' | 'deleted_pending';

export type LocalPdfNavigationShortcut = PdfNavigationShortcut & {
  clientId: string;
  syncStatus: NavigationShortcutSyncStatus;
};

export type SyncOutboxShortcutCreatePayload = {
  clientId: string;
  organizationId: string;
  pieceId: string;
  authorUserId: string;
  input: CreatePdfNavigationShortcutInput;
};

export type SyncOutboxShortcutUpdatePayload = {
  organizationId: string;
  pieceFileId: string;
  shortcutId: string;
  input: UpdatePdfNavigationShortcutInput;
};

export type SyncOutboxShortcutDeletePayload = {
  organizationId: string;
  pieceFileId: string;
  shortcutId: string;
};

export type SyncOutboxShortcutReorderPayload = {
  organizationId: string;
  pieceFileId: string;
  orderedIds: string[];
};

export type NavigationShortcutSyncOutboxItem = {
  id: string;
  op: 'shortcut_create' | 'shortcut_update' | 'shortcut_delete' | 'shortcut_reorder';
  payload:
    | SyncOutboxShortcutCreatePayload
    | SyncOutboxShortcutUpdatePayload
    | SyncOutboxShortcutDeletePayload
    | SyncOutboxShortcutReorderPayload;
  createdAt: string;
  retryCount: number;
};

export type OfflineNavigationShortcutStore = {
  listForFile(organizationId: string, pieceFileId: string): Promise<LocalPdfNavigationShortcut[]>;
  upsert(shortcut: LocalPdfNavigationShortcut): Promise<void>;
  removeLocal(organizationId: string, pieceFileId: string, clientId: string): Promise<void>;
  replaceClientId(clientId: string, serverId: string, updatedAt: string): Promise<void>;
  listPendingForFile(
    organizationId: string,
    pieceFileId: string,
  ): Promise<LocalPdfNavigationShortcut[]>;
  enqueueOutbox(item: Omit<NavigationShortcutSyncOutboxItem, 'retryCount'>): Promise<void>;
  listOutbox(): Promise<NavigationShortcutSyncOutboxItem[]>;
  removeOutbox(id: string): Promise<void>;
  incrementOutboxRetry(id: string): Promise<void>;
  clearAll(): Promise<void>;
};
