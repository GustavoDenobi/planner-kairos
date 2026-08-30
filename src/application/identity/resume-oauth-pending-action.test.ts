import { describe, expect, it, vi } from 'vitest';
import type { GroupInviteRepository } from '@/application/ports';
import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { MusicianClaimRepository } from '@/application/ports/musician-claim-repository';
import type { ProfileRepository } from '@/application/ports/profile-repository';
import { resumeOAuthPendingAction } from './resume-oauth-pending-action';

function createInviteRepo(overrides: Partial<GroupInviteRepository> = {}): GroupInviteRepository {
  return {
    previewByToken: vi.fn(),
    redeem: vi.fn().mockResolvedValue('minha-org'),
    create: vi.fn(),
    revoke: vi.fn(),
    updateExpires: vi.fn(),
    updateMaxUses: vi.fn(),
    listForOrg: vi.fn(),
    ...overrides,
  };
}

function createClaimRepo(overrides: Partial<MusicianClaimRepository> = {}): MusicianClaimRepository {
  return {
    previewByMusicianId: vi.fn(),
    claim: vi.fn().mockResolvedValue('minha-org'),
    ...overrides,
  };
}

function createProfileRepo(overrides: Partial<ProfileRepository> = {}): ProfileRepository {
  return {
    getById: vi.fn(),
    updateDisplayName: vi.fn(),
    updateTheme: vi.fn(),
    ...overrides,
  };
}

function createLegalRepo(overrides: Partial<LegalAcceptanceRepository> = {}): LegalAcceptanceRepository {
  return {
    recordAcceptance: vi.fn(),
    hasAcceptedVersion: vi.fn(),
    listLatestByUser: vi.fn(),
    getLatestOrganizationRulesAcceptance: vi.fn(),
    ...overrides,
  };
}

describe('resumeOAuthPendingAction', () => {
  it('redirects login flow to org selector', async () => {
    const result = await resumeOAuthPendingAction(
      {
        inviteRepo: createInviteRepo(),
        claimRepo: createClaimRepo(),
        profileRepo: createProfileRepo(),
        legalRepo: createLegalRepo(),
      },
      { kind: 'login' },
      'user-1',
    );

    expect(result).toEqual({ ok: true, redirectTo: '/orgs' });
  });

  it('returns invite login path unchanged', async () => {
    const result = await resumeOAuthPendingAction(
      {
        inviteRepo: createInviteRepo(),
        claimRepo: createClaimRepo(),
        profileRepo: createProfileRepo(),
        legalRepo: createLegalRepo(),
      },
      { kind: 'invite_login', returnPath: '/convite/abc' },
      'user-1',
    );

    expect(result).toEqual({ ok: true, redirectTo: '/convite/abc' });
  });

  it('records legal acceptances and redeems invite signup', async () => {
    const legalRepo = createLegalRepo();
    const profileRepo = createProfileRepo();
    const inviteRepo = createInviteRepo();

    const result = await resumeOAuthPendingAction(
      {
        inviteRepo,
        claimRepo: createClaimRepo(),
        profileRepo,
        legalRepo,
      },
      {
        kind: 'invite_signup',
        token: 'token-1',
        displayName: 'Maria Silva',
        phone: '(11) 98765-4321',
        birthDate: '15/05/1990',
        fallbackPath: '/convite/token-1',
      },
      'user-1',
    );

    expect(result).toEqual({ ok: true, redirectTo: '/minha-org/agenda' });
    expect(legalRepo.recordAcceptance).toHaveBeenCalledTimes(2);
    expect(profileRepo.updateDisplayName).toHaveBeenCalledWith('user-1', 'Maria Silva');
    expect(inviteRepo.redeem).toHaveBeenCalledWith('token-1', {
      phone: '11987654321',
      birthDate: '1990-05-15',
    });
  });

  it('claims musician after google signup', async () => {
    const legalRepo = createLegalRepo();
    const profileRepo = createProfileRepo();
    const claimRepo = createClaimRepo();

    const result = await resumeOAuthPendingAction(
      {
        inviteRepo: createInviteRepo(),
        claimRepo,
        profileRepo,
        legalRepo,
      },
      {
        kind: 'musician_signup',
        musicianId: 'musician-1',
        displayName: 'João Souza',
        phone: '(11) 91234-5678',
        birthDate: '10/03/1988',
        fallbackPath: '/musico/musician-1',
      },
      'user-1',
    );

    expect(result).toEqual({ ok: true, redirectTo: '/minha-org/agenda' });
    expect(legalRepo.recordAcceptance).toHaveBeenCalledTimes(2);
    expect(profileRepo.updateDisplayName).toHaveBeenCalledWith('user-1', 'João Souza');
    expect(claimRepo.claim).toHaveBeenCalledWith('musician-1', {
      displayName: 'João Souza',
      phone: '11912345678',
      birthDate: '1988-03-10',
    });
  });
});
