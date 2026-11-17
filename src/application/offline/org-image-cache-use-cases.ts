import type { OfflineOrgImageCache } from '@/application/ports/offline-org-image-cache';

const memoryObjectUrls = new Map<string, string>();
const inflightResolves = new Map<string, Promise<string | null>>();

type SignedUrlLoader = (storageKey: string) => Promise<string>;

function rememberObjectUrl(storageKey: string, objectUrl: string): string {
  const existing = memoryObjectUrls.get(storageKey);
  if (existing && existing !== objectUrl) {
    URL.revokeObjectURL(existing);
  }
  memoryObjectUrls.set(storageKey, objectUrl);
  return objectUrl;
}

export function getCachedOrgImageObjectUrl(storageKey: string): string | null {
  return memoryObjectUrls.get(storageKey) ?? null;
}

export async function resolveOrgImageObjectUrl(
  cache: OfflineOrgImageCache,
  storageKey: string,
  getSignedUrl: SignedUrlLoader,
): Promise<string | null> {
  const cached = memoryObjectUrls.get(storageKey);
  if (cached) {
    return cached;
  }

  const inflight = inflightResolves.get(storageKey);
  if (inflight) {
    return inflight;
  }

  const task = resolveOrgImageObjectUrlOnce(cache, storageKey, getSignedUrl);
  inflightResolves.set(storageKey, task);

  try {
    return await task;
  } finally {
    if (inflightResolves.get(storageKey) === task) {
      inflightResolves.delete(storageKey);
    }
  }
}

async function resolveOrgImageObjectUrlOnce(
  cache: OfflineOrgImageCache,
  storageKey: string,
  getSignedUrl: SignedUrlLoader,
): Promise<string | null> {
  const blob = await cache.getBlob(storageKey);
  if (blob) {
    return rememberObjectUrl(storageKey, URL.createObjectURL(blob));
  }

  try {
    const signedUrl = await getSignedUrl(storageKey);
    const response = await fetch(signedUrl);
    if (!response.ok) {
      return null;
    }

    const fetchedBlob = await response.blob();
    await cache.put({
      storageKey,
      cachedAt: new Date().toISOString(),
      blob: fetchedBlob,
    });
    return rememberObjectUrl(storageKey, URL.createObjectURL(fetchedBlob));
  } catch {
    return null;
  }
}

export function prefetchOrgImages(
  cache: OfflineOrgImageCache,
  storageKeys: Array<string | null | undefined>,
  getSignedUrl: SignedUrlLoader,
): void {
  for (const storageKey of storageKeys) {
    if (!storageKey || memoryObjectUrls.has(storageKey) || inflightResolves.has(storageKey)) {
      continue;
    }
    void resolveOrgImageObjectUrl(cache, storageKey, getSignedUrl);
  }
}

export async function removeOrgImageFromCache(
  cache: OfflineOrgImageCache,
  storageKey: string,
): Promise<void> {
  const objectUrl = memoryObjectUrls.get(storageKey);
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    memoryObjectUrls.delete(storageKey);
  }
  inflightResolves.delete(storageKey);
  await cache.remove(storageKey);
}

export function clearOrgImageMemoryCache(): void {
  for (const objectUrl of memoryObjectUrls.values()) {
    URL.revokeObjectURL(objectUrl);
  }
  memoryObjectUrls.clear();
  inflightResolves.clear();
}
