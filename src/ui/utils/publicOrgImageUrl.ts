export function publicOrgImageUrl(supabaseUrl: string, storageKey: string): string {
  const encodedPath = storageKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/org-assets/${encodedPath}`;
}
