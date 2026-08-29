export function isPermanentSyncAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('row-level security') ||
    message.includes('42501') ||
    message.includes('403') ||
    message.includes('not_allowed') ||
    message.includes('Forbidden')
  );
}

export function resolveSyncAuthorUserId(
  currentUserId: string | null | undefined,
  payloadAuthorUserId: string,
): string | null {
  if (!currentUserId) {
    return null;
  }
  return currentUserId;
}
