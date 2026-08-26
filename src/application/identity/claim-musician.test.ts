import { describe, expect, it, vi } from 'vitest';
import type { AuthGateway } from '@/application/ports/auth-gateway';
import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { MusicianClaimRepository } from '@/application/ports/musician-claim-repository';
import type { ProfileRepository } from '@/application/ports/profile-repository';
import { claimMusician } from './claim-musician';

function createAuth(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    signIn: vi.fn(),
    signUp: vi.fn(),
    signUpForInvite: vi.fn(),
    signUpForMusicianClaim: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    ...overrides,
  };
}

function createClaimRepo(overrides: Partial<MusicianClaimRepository> = {}): MusicianClaimRepository {
  return {
    previewByMusicianId: vi.fn(),
    claim: vi.fn(),
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
    hasAcceptedVersion: vi.fn().mockResolvedValue(false),
    listLatestByUser: vi.fn(),
    getLatestOrganizationRulesAcceptance: vi.fn(),
    ...overrides,
  };
}

describe('claimMusician', () => {
  it('signs up new user and claims musician', async () => {
    const auth = createAuth({
      signUpForMusicianClaim: vi.fn().mockResolvedValue({
        ok: true,
        session: { user: { id: 'user-1' }, accessToken: 'token' },
      }),
    });
    const claimRepo = createClaimRepo({
      claim: vi.fn().mockResolvedValue('kairos'),
    });
    const profileRepo = createProfileRepo({
      updateDisplayName: vi.fn().mockResolvedValue(undefined),
    });
    const legalRepo = createLegalRepo({
      recordAcceptance: vi.fn().mockResolvedValue({
        id: 'acceptance-1',
        userId: 'user-1',
        scope: 'platform',
        organizationId: null,
        documentType: 'terms_of_use',
        documentVersion: '2026-08-25',
        context: 'musician_claim',
        acceptedAt: new Date(),
      }),
    });

    const result = await claimMusician(auth, claimRepo, profileRepo, legalRepo, {
      musicianId: 'musician-1',
      email: 'joao@example.com',
      password: 'secret1',
      displayName: 'João Silva',
      phone: '(11) 98765-4321',
      birthDate: '01/01/1990',
      isNewUser: true,
      platformLegalAccepted: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.organizationSlug).toBe('kairos');
    }
    expect(legalRepo.recordAcceptance).toHaveBeenCalledTimes(2);
    expect(claimRepo.claim).toHaveBeenCalledWith('musician-1', {
      displayName: 'João Silva',
      phone: '11987654321',
      birthDate: '1990-01-01',
    });
  });

  it('claims musician for existing session', async () => {
    const auth = createAuth();
    const claimRepo = createClaimRepo({
      claim: vi.fn().mockResolvedValue('kairos'),
    });
    const profileRepo = createProfileRepo({
      updateDisplayName: vi.fn().mockResolvedValue(undefined),
    });
    const legalRepo = createLegalRepo();

    const result = await claimMusician(auth, claimRepo, profileRepo, legalRepo, {
      musicianId: 'musician-1',
      email: 'joao@example.com',
      password: '',
      displayName: 'João Atualizado',
      isNewUser: false,
      userId: 'user-1',
    });

    expect(result.ok).toBe(true);
    expect(claimRepo.claim).toHaveBeenCalledWith('musician-1', {
      displayName: 'João Atualizado',
      phone: undefined,
      birthDate: undefined,
    });
    expect(profileRepo.updateDisplayName).toHaveBeenCalledWith('user-1', 'João Atualizado');
  });

  it('rejects signup without platform legal acceptance', async () => {
    const auth = createAuth();
    const claimRepo = createClaimRepo();
    const profileRepo = createProfileRepo();
    const legalRepo = createLegalRepo();

    const result = await claimMusician(auth, claimRepo, profileRepo, legalRepo, {
      musicianId: 'musician-1',
      email: 'joao@example.com',
      password: 'secret1',
      displayName: 'João Silva',
      phone: '(11) 98765-4321',
      birthDate: '01/01/1990',
      isNewUser: true,
      platformLegalAccepted: false,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('platform_legal_not_accepted');
    }
  });
});
