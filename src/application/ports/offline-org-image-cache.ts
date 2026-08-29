export type CachedOrgImageMeta = {
  storageKey: string;
  cachedAt: string;
};

export type OfflineOrgImageCache = {
  getBlob(storageKey: string): Promise<Blob | null>;
  put(entry: CachedOrgImageMeta & { blob: Blob }): Promise<void>;
  remove(storageKey: string): Promise<void>;
  clearAll(): Promise<void>;
};
