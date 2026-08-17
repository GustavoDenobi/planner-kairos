import type { AuthGateway, GroupInviteRepository, ProfileRepository } from '@/application/ports';
import { Result } from '@/domain/shared';

export type AcceptGroupInviteInput = {
  token: string;
  email: string;
  password: string;
  displayName: string;
  isNewUser: boolean;
  userId?: string;
};

export async function acceptGroupInvite(
  auth: AuthGateway,
  inviteRepo: GroupInviteRepository,
  profileRepo: ProfileRepository,
  input: AcceptGroupInviteInput,
) {
  if (input.isNewUser) {
    const session = await auth.signUp(input.email, input.password, input.displayName);
    if (!session) {
      return Result.fail('signup_failed');
    }
    await profileRepo.updateDisplayName(session.user.id, input.displayName);
  } else if (!input.userId) {
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
