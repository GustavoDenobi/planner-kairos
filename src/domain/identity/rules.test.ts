import { describe, expect, it } from 'vitest';
import type { GroupInvite } from './group-invite';
import type { PasswordRecoveryCode } from './password-recovery-code';
import {
  canRedeemGroupInvite,
  isGroupInviteValid,
  isPasswordRecoveryCodeValid,
  membershipRoleForInvite,
} from './rules';

const baseInvite = (): GroupInvite => ({
  id: 'invite-1',
  organizationId: 'org-1',
  groupId: 'group-1',
  expiresAt: new Date('2026-08-20T00:00:00Z'),
  revokedAt: null,
  redeemedAt: null,
  redeemedByUserId: null,
  createdByUserId: 'admin-1',
});

const now = new Date('2026-08-17T12:00:00Z');

describe('isGroupInviteValid', () => {
  it('returns true for active invite', () => {
    expect(isGroupInviteValid(baseInvite(), now)).toBe(true);
  });

  it('returns false when revoked', () => {
    const invite = { ...baseInvite(), revokedAt: new Date('2026-08-16T00:00:00Z') };
    expect(isGroupInviteValid(invite, now)).toBe(false);
  });

  it('returns false when redeemed', () => {
    const invite = { ...baseInvite(), redeemedAt: new Date('2026-08-16T00:00:00Z') };
    expect(isGroupInviteValid(invite, now)).toBe(false);
  });

  it('returns false when expired', () => {
    const invite = { ...baseInvite(), expiresAt: new Date('2026-08-16T00:00:00Z') };
    expect(isGroupInviteValid(invite, now)).toBe(false);
  });
});

describe('canRedeemGroupInvite', () => {
  it('returns true when invite valid and no existing musician', () => {
    expect(canRedeemGroupInvite(baseInvite(), now, false)).toBe(true);
  });

  it('returns false when musician already exists in org', () => {
    expect(canRedeemGroupInvite(baseInvite(), now, true)).toBe(false);
  });

  it('returns false when invite invalid', () => {
    const invite = { ...baseInvite(), revokedAt: new Date('2026-08-16T00:00:00Z') };
    expect(canRedeemGroupInvite(invite, now, false)).toBe(false);
  });
});

describe('membershipRoleForInvite', () => {
  it('always returns member', () => {
    expect(membershipRoleForInvite()).toBe('member');
  });
});

describe('isPasswordRecoveryCodeValid', () => {
  const baseCode = (): PasswordRecoveryCode => ({
    id: 'code-1',
    userId: 'user-1',
    email: 'user@example.com',
    expiresAt: new Date('2026-08-17T13:00:00Z'),
    usedAt: null,
  });

  it('returns true for unused non-expired code', () => {
    expect(isPasswordRecoveryCodeValid(baseCode(), now)).toBe(true);
  });

  it('returns false when used', () => {
    const code = { ...baseCode(), usedAt: new Date('2026-08-17T11:00:00Z') };
    expect(isPasswordRecoveryCodeValid(code, now)).toBe(false);
  });

  it('returns false when expired', () => {
    const code = { ...baseCode(), expiresAt: new Date('2026-08-17T11:00:00Z') };
    expect(isPasswordRecoveryCodeValid(code, now)).toBe(false);
  });
});
