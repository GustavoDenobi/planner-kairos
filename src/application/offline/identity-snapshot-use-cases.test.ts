import { describe, expect, it, beforeEach } from 'vitest';
import type { OrganizationWithRole } from '@/application/ports/organization-repository';
import type { OfflineIdentityStore } from '@/application/ports/offline-identity-store';
import {
  findOrganizationBySlug,
  getIdentitySnapshot,
  resolveHomeRedirectPath,
  saveIdentitySnapshot,
  sessionFromIdentitySnapshot,
  sessionFromOfflineSnapshot,
  shouldPromptOfflineOrgSync,
} from '@/application/offline/identity-snapshot-use-cases';

function createIdentityStore(): OfflineIdentityStore {
  let snapshot: import('@/application/ports/offline-identity-store').IdentitySnapshot | null = null;
  return {
    get: async () => snapshot,
    put: async (next) => {
      snapshot = next;
    },
    clear: async () => {
      snapshot = null;
    },
  };
}

const sampleOrgs: OrganizationWithRole[] = [
  {
    id: 'org-1',
    name: 'Kairós',
    slug: 'kairos',
    imageStorageKey: null,
    accessRole: 'member',
  },
];

describe('identity-snapshot-use-cases', () => {
  let store: OfflineIdentityStore;

  beforeEach(() => {
    store = createIdentityStore();
  });

  it('persists and restores identity snapshot', async () => {
    const session = {
      user: { id: 'user-1', email: 'musico@example.com' },
      accessToken: 'token',
    };

    await saveIdentitySnapshot(store, session, sampleOrgs, 'kairos');
    const snapshot = await getIdentitySnapshot(store);

    expect(snapshot?.userId).toBe('user-1');
    expect(snapshot?.email).toBe('musico@example.com');
    expect(snapshot?.organizations).toEqual(sampleOrgs);
    expect(snapshot?.currentOrgSlug).toBe('kairos');
  });

  it('builds offline session from snapshot', () => {
    const session = sessionFromIdentitySnapshot({
      userId: 'user-1',
      email: 'musico@example.com',
      organizations: sampleOrgs,
      currentOrgSlug: 'kairos',
      cachedAt: new Date().toISOString(),
    });

    expect(session.user.id).toBe('user-1');
    expect(session.user.email).toBe('musico@example.com');
    expect(session.accessToken).toBe('');
  });

  it('finds organization by slug in snapshot list', () => {
    const org = findOrganizationBySlug(sampleOrgs, 'kairos');
    expect(org?.id).toBe('org-1');
    expect(findOrganizationBySlug(sampleOrgs, 'missing')).toBeNull();
  });

  it('restores snapshot session only while offline', () => {
    const snapshot = {
      userId: 'user-1',
      email: 'musico@example.com',
      organizations: sampleOrgs,
      currentOrgSlug: 'kairos',
      cachedAt: new Date().toISOString(),
    };

    expect(sessionFromOfflineSnapshot(true, snapshot)).toBeNull();
    expect(sessionFromOfflineSnapshot(false, null)).toBeNull();
    expect(sessionFromOfflineSnapshot(false, snapshot)?.user.id).toBe('user-1');
  });

  it('sends online users without session to login', () => {
    const snapshot = {
      userId: 'user-1',
      email: 'musico@example.com',
      organizations: sampleOrgs,
      currentOrgSlug: 'kairos',
      cachedAt: new Date().toISOString(),
    };

    expect(
      resolveHomeRedirectPath({
        hasSession: false,
        isOnline: true,
        storedOrgSlug: 'kairos',
        snapshot,
      }),
    ).toBe('/login');

    expect(
      resolveHomeRedirectPath({
        hasSession: true,
        isOnline: true,
        storedOrgSlug: 'kairos',
        snapshot: null,
      }),
    ).toBe('/kairos/leitura');

    expect(
      resolveHomeRedirectPath({
        hasSession: false,
        isOnline: false,
        storedOrgSlug: null,
        snapshot,
      }),
    ).toBe('/kairos/leitura');
  });

  it('only prompts offline org sync when offline or using cached data', () => {
    expect(shouldPromptOfflineOrgSync(true, false)).toBe(false);
    expect(shouldPromptOfflineOrgSync(true, true)).toBe(true);
    expect(shouldPromptOfflineOrgSync(false, false)).toBe(true);
  });
});
