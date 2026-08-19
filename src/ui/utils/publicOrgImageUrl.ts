import { normalizeEnvUrl } from '../../domain/shared/normalizeEnvUrl.js';

export function publicOrgImageUrl(supabaseUrl: string, storageKey: string): string {
  const encodedPath = storageKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${normalizeEnvUrl(supabaseUrl)}/storage/v1/object/public/org-assets/${encodedPath}`;
}
