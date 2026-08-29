import type { OfflineOrgImageCache } from '@/application/ports/offline-org-image-cache';
import { normalizeEnvUrl } from '@/domain/shared/normalizeEnvUrl';

const memoryObjectUrls = new Map<string, string>();
const inflightResolves = new Map<string, Promise<string | null>>();

function buildPublicOrgImageUrl(supabaseUrl: string, storageKey: string): string {
  const encodedPath = storageKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${normalizeEnvUrl(supabaseUrl)}/storage/v1/object/public/org-assets/${encodedPath}`;
}

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
  supabaseUrl: string,
): Promise<string | null> {
  const cached = memoryObjectUrls.get(storageKey);
  if (cached) {
    return cached;
  }

  const inflight = inflightResolves.get(storageKey);
  if (inflight) {
    return inflight;
  }

  const publicUrl = buildPublicOrgImageUrl(supabaseUrl, storageKey);
  const task = resolveOrgImageObjectUrlOnce(cache, storageKey, publicUrl);
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
  publicUrl: string,
): Promise<string | null> {
  const blob = await cache.getBlob(storageKey);
  if (blob) {
    return rememberObjectUrl(storageKey, URL.createObjectURL(blob));
  }

  try {
    const response = await fetch(publicUrl);
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
  supabaseUrl: string,
): void {
  for (const storageKey of storageKeys) {
    if (!storageKey || memoryObjectUrls.has(storageKey) || inflightResolves.has(storageKey)) {
      continue;
    }
    void resolveOrgImageObjectUrl(cache, storageKey, supabaseUrl);
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
