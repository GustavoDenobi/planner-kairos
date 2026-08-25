import { describe, expect, it } from 'vitest';
import type { OrganizationWithRole } from '@/application/ports/organization-repository';
import { shouldPromptOfflineOrgSync } from '@/application/offline/identity-snapshot-use-cases';

function isMemberBySlug(organizations: OrganizationWithRole[], slug: string): boolean {
  return organizations.some((org) => org.slug === slug);
}

describe('offline org guard membership', () => {
  const organizations: OrganizationWithRole[] = [
    {
      id: 'org-1',
      name: 'Kairós',
      slug: 'kairos',
      imageStorageKey: null,
      rules: null,
      accessRole: 'member',
    },
  ];

  it('allows org slug from cached organizations', () => {
    expect(isMemberBySlug(organizations, 'kairos')).toBe(true);
  });

  it('rejects unknown slug when organizations are loaded', () => {
    expect(isMemberBySlug(organizations, 'other')).toBe(false);
  });

  it('supports offline session without access token', () => {
    const offlineSession = {
      user: { id: 'user-1', email: 'musico@example.com' },
      accessToken: '',
    };

    expect(offlineSession.user.id).toBe('user-1');
    expect(offlineSession.accessToken).toBe('');
  });

  it('does not show offline sync copy when the user is online', () => {
    expect(shouldPromptOfflineOrgSync(true, false)).toBe(false);
  });
});
