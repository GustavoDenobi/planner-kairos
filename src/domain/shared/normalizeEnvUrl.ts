export function normalizeEnvUrl(value: string): string {
  return value
    .trim()
    .replace(/\\r\\n/g, '')
    .replace(/\r?\n/g, '')
    .replace(/\/$/, '');
}

export const normalizeSiteOrigin = normalizeEnvUrl;
