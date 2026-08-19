import type { AuthSession } from '@/application/ports/auth-gateway';
import type { OrganizationWithRole } from '@/application/ports/organization-repository';
import type { IdentitySnapshot, OfflineIdentityStore } from '@/application/ports/offline-identity-store';

export function sessionFromIdentitySnapshot(snapshot: IdentitySnapshot): AuthSession {
  return {
    user: {
      id: snapshot.userId,
      email: snapshot.email,
    },
    accessToken: '',
  };
}

export async function getIdentitySnapshot(
  identityStore: OfflineIdentityStore,
): Promise<IdentitySnapshot | null> {
  return identityStore.get();
}

export async function saveIdentitySnapshot(
  identityStore: OfflineIdentityStore,
  session: AuthSession,
  organizations: OrganizationWithRole[],
  currentOrgSlug: string | null,
): Promise<void> {
  await identityStore.put({
    userId: session.user.id,
    email: session.user.email ?? '',
    organizations,
    currentOrgSlug,
    cachedAt: new Date().toISOString(),
  });
}

export async function clearIdentitySnapshot(identityStore: OfflineIdentityStore): Promise<void> {
  await identityStore.clear();
}

export function findOrganizationBySlug(
  organizations: OrganizationWithRole[],
  slug: string,
): OrganizationWithRole | null {
  return organizations.find((org) => org.slug === slug) ?? null;
}
