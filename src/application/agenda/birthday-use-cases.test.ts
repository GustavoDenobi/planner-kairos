import { describe, expect, it, vi } from 'vitest';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import { listMusicianBirthdaysInRangeForAdmin } from '@/application/agenda/birthday-use-cases';

function createRepos(role: 'owner' | 'admin' | 'member' | null) {
  const membershipRepo: MembershipRepository = {
    getByUserAndOrg: async () =>
      role
        ? { id: 'mem-1', organizationId: 'org-1', userId: 'user-1', accessRole: role }
        : null,
    grantAdmin: vi.fn(),
    revokeAdmin: vi.fn(),
  };

  const musicianRepo: MusicianRepository = {
    listForOrg: async () => ({ items: [], totalCount: 0, hasMore: false }),
    listBirthdaysForOrg: async () => [
      {
        id: 'm1',
        fullName: 'Ana Silva',
        birthDate: '1990-05-15',
        assignments: [],
      },
    ],
    listNamesForOrg: async () => [],
    getById: async () => null,
    getByUserId: async () => null,
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    merge: vi.fn(),
  };

  return { membershipRepo, musicianRepo };
}

describe('listMusicianBirthdaysInRangeForAdmin', () => {
  it('returns birthdays for admins', async () => {
    const { membershipRepo, musicianRepo } = createRepos('admin');

    const result = await listMusicianBirthdaysInRangeForAdmin(
      membershipRepo,
      musicianRepo,
      'org-1',
      'user-1',
      {
        from: '2026-05-11T00:00:00.000Z',
        to: '2026-05-18T00:00:00.000Z',
      },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.fullName).toBe('Ana Silva');
    }
  });

  it('rejects members', async () => {
    const { membershipRepo, musicianRepo } = createRepos('member');

    const result = await listMusicianBirthdaysInRangeForAdmin(
      membershipRepo,
      musicianRepo,
      'org-1',
      'user-1',
      {
        from: '2026-05-11T00:00:00.000Z',
        to: '2026-05-18T00:00:00.000Z',
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_allowed');
    }
  });

  it('rejects non-members', async () => {
    const { membershipRepo, musicianRepo } = createRepos(null);

    const result = await listMusicianBirthdaysInRangeForAdmin(
      membershipRepo,
      musicianRepo,
      'org-1',
      'user-1',
      {
        from: '2026-05-11T00:00:00.000Z',
        to: '2026-05-18T00:00:00.000Z',
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_a_member');
    }
  });
});
