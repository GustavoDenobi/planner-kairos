import { describe, expect, it, vi } from 'vitest';
import type { OrganizationRepository } from '@/application/ports/organization-repository';
import { setCurrentOrganization } from '@/application/identity/set-current-organization';

function createOrgRepo(orgs: import('@/application/ports/organization-repository').OrganizationWithRole[]): OrganizationRepository {
  return {
    isPlatformAdmin: async () => false,
    listForUser: async () => orgs,
    listAllForPlatformAdmin: async () => orgs,
    getBySlug: async (slug) => orgs.find((org) => org.slug === slug) ?? null,
    getById: async (id) => orgs.find((org) => org.id === id) ?? null,
    updateImageKey: vi.fn(),
    clearImage: vi.fn(),
    updateName: vi.fn(),
    updateRules: vi.fn(),
  };
}

describe('setCurrentOrganization', () => {
  const orgs = [
    {
      id: 'org-1',
      name: 'Kairós',
      slug: 'kairos',
      imageStorageKey: null,
      rules: null,
      accessRole: 'member' as const,
    },
  ];

  it('accepts slug when user belongs to organization', async () => {
    const result = await setCurrentOrganization(createOrgRepo(orgs), 'user-1', 'kairos');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slug).toBe('kairos');
    }
  });

  it('rejects slug when user is not a member', async () => {
    const result = await setCurrentOrganization(createOrgRepo(orgs), 'user-1', 'other');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_a_member');
    }
  });

  it('allows platform admin to access org without membership', async () => {
    const repo = createOrgRepo(orgs);
    repo.isPlatformAdmin = async () => true;
    repo.listAllForPlatformAdmin = async () => [];
    repo.getBySlug = async () => ({
      id: 'org-2',
      name: 'Other',
      slug: 'other',
      imageStorageKey: null,
      rules: null,
    });

    const result = await setCurrentOrganization(repo, 'admin-1', 'other');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.slug).toBe('other');
      expect(result.value.accessRole).toBe('owner');
    }
  });

  it('fails when listing organizations throws', async () => {
    const repo = createOrgRepo(orgs);
    repo.listForUser = async () => {
      throw new Error('jwt expired');
    };

    const result = await setCurrentOrganization(repo, 'user-1', 'kairos');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('list_failed');
    }
  });
});
