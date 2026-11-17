import { normalizeEnvUrl } from '../domain/shared/normalizeEnvUrl.js';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export function isOrgBrandingStorageKey(organizationId: string, storageKey: string): boolean {
  if (!organizationId || !storageKey) {
    return false;
  }

  if (storageKey.includes('..') || storageKey.includes('\\') || storageKey.includes('/pieces/')) {
    return false;
  }

  return storageKey.startsWith(`${organizationId}/branding/`);
}

export async function signOrgBrandingUrl(options: {
  supabaseUrl: string;
  serviceRoleKey: string;
  organizationId: string;
  storageKey: string;
}): Promise<string | null> {
  if (!isOrgBrandingStorageKey(options.organizationId, options.storageKey)) {
    return null;
  }

  const supabaseUrl = normalizeEnvUrl(options.supabaseUrl);
  const encodedPath = options.storageKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/org-assets/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: options.serviceRoleKey,
      Authorization: `Bearer ${options.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signed = body.signedUrl ?? body.signedURL;
  if (!signed) {
    return null;
  }

  if (signed.startsWith('http://') || signed.startsWith('https://')) {
    return signed;
  }

  const path = signed.startsWith('/') ? signed : `/${signed}`;
  return `${supabaseUrl}/storage/v1${path}`;
}
