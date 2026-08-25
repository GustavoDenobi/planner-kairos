import { describe, expect, it, vi } from 'vitest';
import type { AuthGateway } from '@/application/ports/auth-gateway';
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

    const result = await claimMusician(auth, claimRepo, profileRepo, {
      musicianId: 'musician-1',
      email: 'joao@example.com',
      password: 'secret1',
      displayName: 'João Silva',
      phone: '(11) 98765-4321',
      birthDate: '01/01/1990',
      isNewUser: true,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.organizationSlug).toBe('kairos');
    }
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

    const result = await claimMusician(auth, claimRepo, profileRepo, {
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
});
