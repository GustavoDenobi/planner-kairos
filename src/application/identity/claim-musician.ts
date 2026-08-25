import type { AuthGateway, MusicianClaimRepository, ProfileRepository } from '@/application/ports';
import { normalizePhone } from '@/domain/ensemble';
import {
  getInviteSignupFieldErrors,
  hasInviteSignupFieldErrors,
  normalizeInviteBirthDate,
  type InviteSignupFieldErrors,
} from '@/domain/identity';
import { Result } from '@/domain/shared';

export type ClaimMusicianInput = {
  musicianId: string;
  displayName: string;
  email: string;
  password: string;
  phone?: string;
  birthDate?: string;
  isNewUser: boolean;
  userId?: string;
};

export type ClaimMusicianError =
  | InviteSignupFieldErrors
  | 'signup_failed'
  | 'email_taken'
  | 'not_found'
  | 'already_claimed'
  | 'not_authenticated'
  | string;

export async function claimMusician(
  auth: AuthGateway,
  claimRepo: MusicianClaimRepository,
  profileRepo: ProfileRepository,
  input: ClaimMusicianInput,
) {
  if (input.isNewUser) {
    const fieldErrors = getInviteSignupFieldErrors({
      displayName: input.displayName,
      email: input.email,
      phone: input.phone ?? '',
      birthDate: input.birthDate ?? '',
      password: input.password,
    });

    if (hasInviteSignupFieldErrors(fieldErrors)) {
      return Result.fail(fieldErrors);
    }

    const signup = await auth.signUpForMusicianClaim({
      musicianId: input.musicianId,
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    });
    if (!signup.ok) {
      return Result.fail(signup.error);
    }

    const session = signup.session;
    await profileRepo.updateDisplayName(session.user.id, input.displayName);

    try {
      const orgSlug = await claimRepo.claim(input.musicianId, {
        displayName: input.displayName.trim(),
        phone: normalizePhone(input.phone ?? ''),
        birthDate: normalizeInviteBirthDate(input.birthDate ?? ''),
      });
      return Result.ok({ organizationSlug: orgSlug });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'claim_failed';
      return Result.fail(message);
    }
  }

  if (!input.userId) {
    return Result.fail('not_authenticated');
  }

  if (!input.displayName.trim()) {
    return Result.fail({ displayName: 'required' } satisfies InviteSignupFieldErrors);
  }

  try {
    const orgSlug = await claimRepo.claim(input.musicianId, {
      displayName: input.displayName.trim(),
      phone: input.phone ? normalizePhone(input.phone) : undefined,
      birthDate: input.birthDate ? normalizeInviteBirthDate(input.birthDate) : undefined,
    });
    await profileRepo.updateDisplayName(input.userId, input.displayName.trim());
    return Result.ok({ organizationSlug: orgSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'claim_failed';
    return Result.fail(message);
  }
}
