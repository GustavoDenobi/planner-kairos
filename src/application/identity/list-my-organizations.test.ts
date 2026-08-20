import { describe, expect, it, vi } from 'vitest';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import { listMyOrganizations } from '@/application/identity/list-my-organizations';

function createOrgRepo(
  orgs: import('@/application/ports/organization-repository').OrganizationWithRole[],
): OrganizationRepository {
  return {
    listForUser: async () => orgs,
    getBySlug: async (slug) => orgs.find((org) => org.slug === slug) ?? null,
    getById: async (id) => orgs.find((org) => org.id === id) ?? null,
    updateImageKey: vi.fn(),
    clearImage: vi.fn(),
    updateName: vi.fn(),
  };
}

describe('listMyOrganizations', () => {
  const orgs = [
    {
      id: 'org-1',
      name: 'Kairós',
      slug: 'kairos',
      imageStorageKey: null,
      accessRole: 'member' as const,
    },
  ];

  it('returns organizations for the user', async () => {
    const result = await listMyOrganizations(createOrgRepo(orgs), 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(orgs);
    }
  });

  it('returns empty list when the user has no memberships', async () => {
    const result = await listMyOrganizations(createOrgRepo([]), 'user-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it('fails when listing organizations throws', async () => {
    const repo = createOrgRepo(orgs);
    repo.listForUser = async () => {
      throw new Error('JWT expired');
    };

    const result = await listMyOrganizations(repo, 'user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('list_failed');
    }
  });
});
