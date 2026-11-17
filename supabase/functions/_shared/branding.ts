export function isOrgBrandingStorageKey(organizationId: string, storageKey: string): boolean {
  if (!organizationId || !storageKey) {
    return false;
  }

  if (storageKey.includes('..') || storageKey.includes('\\') || storageKey.includes('/pieces/')) {
    return false;
  }

  return storageKey.startsWith(`${organizationId}/branding/`);
}
