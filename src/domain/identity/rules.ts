import type { AccessRole } from './membership';
import type { GroupInvite } from './group-invite';
import type { PasswordRecoveryCode } from './password-recovery-code';

export function isGroupInviteValid(invite: GroupInvite, now: Date): boolean {
  return invite.revokedAt === null && invite.redeemedAt === null && invite.expiresAt > now;
}

export function canRedeemGroupInvite(
  invite: GroupInvite,
  now: Date,
  existingMusicianInOrg: boolean,
): boolean {
  if (!isGroupInviteValid(invite, now)) {
    return false;
  }

  if (existingMusicianInOrg) {
    return false;
  }

  return true;
}

export function membershipRoleForInvite(): AccessRole {
  return 'member';
}

export function isPasswordRecoveryCodeValid(code: PasswordRecoveryCode, now: Date): boolean {
  return code.usedAt === null && code.expiresAt > now;
}
