import type { AuthGateway, GroupInviteRepository, ProfileRepository } from '@/application/ports';
import { normalizePhone } from '@/domain/ensemble';
import {
  getInviteSignupFieldErrors,
  hasInviteSignupFieldErrors,
  normalizeInviteBirthDate,
  type InviteSignupFieldErrors,
} from '@/domain/identity';
import { Result } from '@/domain/shared';

export type AcceptGroupInviteInput = {
  token: string;
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  birthDate?: string;
  isNewUser: boolean;
  userId?: string;
};

export type AcceptGroupInviteError =
  | InviteSignupFieldErrors
  | 'signup_failed'
  | 'email_taken'
  | 'invalid_invite'
  | 'not_authenticated'
  | string;

export async function acceptGroupInvite(
  auth: AuthGateway,
  inviteRepo: GroupInviteRepository,
  profileRepo: ProfileRepository,
  input: AcceptGroupInviteInput,
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

    const signup = await auth.signUpForInvite({
      token: input.token,
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
      const orgSlug = await inviteRepo.redeem(input.token, {
        phone: normalizePhone(input.phone ?? ''),
        birthDate: normalizeInviteBirthDate(input.birthDate ?? ''),
      });
      return Result.ok({ organizationSlug: orgSlug });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'redeem_failed';
      return Result.fail(message);
    }
  }

  if (!input.userId) {
    return Result.fail('not_authenticated');
  }

  try {
    const orgSlug = await inviteRepo.redeem(input.token);
    return Result.ok({ organizationSlug: orgSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'redeem_failed';
    return Result.fail(message);
  }
}
