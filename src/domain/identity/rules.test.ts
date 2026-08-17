import { describe, expect, it } from 'vitest';
import type { GroupInvite } from './group-invite';
import type { PasswordRecoveryCode } from './password-recovery-code';
import {
  canRedeemGroupInvite,
  getInviteSignupFieldErrors,
  hasInviteSignupFieldErrors,
  isGroupInviteValid,
  isPasswordRecoveryCodeValid,
  isValidInviteBirthDate,
  isValidInviteSignupPassword,
  normalizeInviteBirthDate,
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

describe('getInviteSignupFieldErrors', () => {
  const validInput = {
    displayName: 'Maria Silva',
    email: 'maria@example.com',
    phone: '(11) 98765-4321',
    birthDate: '15/05/1990',
    password: '123456',
  };

  it('returns no errors for valid input', () => {
    expect(getInviteSignupFieldErrors(validInput)).toEqual({});
    expect(hasInviteSignupFieldErrors(getInviteSignupFieldErrors(validInput))).toBe(false);
  });

  it('requires all fields', () => {
    const errors = getInviteSignupFieldErrors({
      displayName: '',
      email: '',
      phone: '',
      birthDate: '',
      password: '',
    });

    expect(errors).toEqual({
      displayName: 'required',
      email: 'required',
      phone: 'required',
      birthDate: 'required',
      password: 'required',
    });
  });

  it('validates email, phone and password format', () => {
    const errors = getInviteSignupFieldErrors({
      displayName: 'Maria',
      email: 'invalid',
      phone: '123',
      birthDate: '01/01/2030',
      password: '12345',
    });

    expect(errors).toEqual({
      email: 'invalid_email',
      phone: 'invalid_phone',
      birthDate: 'invalid_birth_date',
      password: 'password_too_short',
    });
  });
});

describe('isValidInviteBirthDate', () => {
  it('accepts valid past dates in DD/MM/YYYY', () => {
    expect(isValidInviteBirthDate('15/05/1990')).toBe(true);
  });

  it('accepts valid past dates in ISO format', () => {
    expect(isValidInviteBirthDate('1990-05-15')).toBe(true);
  });

  it('rejects empty, incomplete and future dates', () => {
    expect(isValidInviteBirthDate('')).toBe(false);
    expect(isValidInviteBirthDate('15/05/199')).toBe(false);
    expect(isValidInviteBirthDate('01/01/2030')).toBe(false);
    expect(isValidInviteBirthDate('31/02/1990')).toBe(false);
  });
});

describe('normalizeInviteBirthDate', () => {
  it('converts DD/MM/YYYY to ISO', () => {
    expect(normalizeInviteBirthDate('15/05/1990')).toBe('1990-05-15');
  });
});

describe('isValidInviteSignupPassword', () => {
  it('accepts passwords with at least 6 characters', () => {
    expect(isValidInviteSignupPassword('123456')).toBe(true);
    expect(isValidInviteSignupPassword('12345')).toBe(false);
  });
});
