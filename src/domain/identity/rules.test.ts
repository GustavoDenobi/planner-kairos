import { describe, expect, it } from 'vitest';
import type { GroupInvite } from './group-invite';
import type { PasswordRecoveryCode } from './password-recovery-code';
import {
  canGrantAdminRole,
  canManageAdminRole,
  canRedeemGroupInvite,
  canRevokeAdminRole,
  getInviteSignupFieldErrors,
  getOAuthOnboardingFieldErrors,
  hasInviteSignupFieldErrors,
  hasOAuthOnboardingFieldErrors,
  isGroupInviteExhausted,
  isGroupInviteValid,
  isPasswordRecoveryCodeValid,
  isValidInviteBirthDate,
  isValidInviteSignupPassword,
  normalizeInviteBirthDate,
  membershipRoleForInvite,
  validateOrganizationImageDimensions,
  validateOrganizationImageMime,
} from './rules';

const baseInvite = (): GroupInvite => ({
  id: 'invite-1',
  organizationId: 'org-1',
  groupId: 'group-1',
  expiresAt: new Date('2026-08-20T00:00:00Z'),
  maxUses: 0,
  revokedAt: null,
  redeemedAt: null,
  redeemedByUserId: null,
  createdByUserId: 'admin-1',
});

const now = new Date('2026-08-17T12:00:00Z');

describe('isGroupInviteValid', () => {
  it('returns true for active invite', () => {
    expect(isGroupInviteValid(baseInvite(), now, 0)).toBe(true);
  });

  it('returns false when revoked', () => {
    const invite = { ...baseInvite(), revokedAt: new Date('2026-08-16T00:00:00Z') };
    expect(isGroupInviteValid(invite, now, 0)).toBe(false);
  });

  it('returns false when exhausted', () => {
    const invite = { ...baseInvite(), maxUses: 2 };
    expect(isGroupInviteValid(invite, now, 2)).toBe(false);
  });

  it('returns false when expired', () => {
    const invite = { ...baseInvite(), expiresAt: new Date('2026-08-16T00:00:00Z') };
    expect(isGroupInviteValid(invite, now, 0)).toBe(false);
  });
});

describe('isGroupInviteExhausted', () => {
  it('returns false when unlimited', () => {
    expect(isGroupInviteExhausted(0, 10)).toBe(false);
  });

  it('returns true when use count reaches limit', () => {
    expect(isGroupInviteExhausted(3, 3)).toBe(true);
  });
});

describe('canRedeemGroupInvite', () => {
  it('returns true when invite valid and no existing musician', () => {
    expect(canRedeemGroupInvite(baseInvite(), now, 0, false)).toBe(true);
  });

  it('returns false when musician already exists in org', () => {
    expect(canRedeemGroupInvite(baseInvite(), now, 0, true)).toBe(false);
  });

  it('returns false when invite invalid', () => {
    const invite = { ...baseInvite(), revokedAt: new Date('2026-08-16T00:00:00Z') };
    expect(canRedeemGroupInvite(invite, now, 0, false)).toBe(false);
  });
});

describe('membershipRoleForInvite', () => {
  it('always returns member', () => {
    expect(membershipRoleForInvite()).toBe('member');
  });
});

describe('canManageAdminRole', () => {
  it('allows owners and admins to manage other non-owner users', () => {
    expect(canManageAdminRole('owner', 'user-1', 'user-2', 'member')).toBeNull();
    expect(canManageAdminRole('admin', 'user-1', 'user-2', 'member')).toBeNull();
  });

  it('blocks members and owner targets', () => {
    expect(canManageAdminRole('member', 'user-1', 'user-2', 'member')).toBe('forbidden');
    expect(canManageAdminRole('owner', 'user-1', 'user-2', 'owner')).toBe('target_is_owner');
  });

  it('blocks self-management and musicians without linked account', () => {
    expect(canManageAdminRole('owner', 'user-1', 'user-1', 'member')).toBe('cannot_manage_self');
    expect(canManageAdminRole('owner', 'user-1', null, null)).toBe('no_linked_user');
  });
});

describe('canGrantAdminRole', () => {
  it('allows promoting members', () => {
    expect(canGrantAdminRole('member')).toBeNull();
  });

  it('blocks promoting existing admins', () => {
    expect(canGrantAdminRole('admin')).toBe('already_admin');
  });
});

describe('canRevokeAdminRole', () => {
  it('allows revoking admins', () => {
    expect(canRevokeAdminRole('admin')).toBeNull();
  });

  it('blocks revoking non-admins', () => {
    expect(canRevokeAdminRole('member')).toBe('not_admin');
    expect(canRevokeAdminRole('owner')).toBe('not_admin');
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

describe('getOAuthOnboardingFieldErrors', () => {
  const validInput = {
    displayName: 'Maria Silva',
    phone: '(11) 98765-4321',
    birthDate: '15/05/1990',
  };

  it('returns no errors for valid input', () => {
    expect(getOAuthOnboardingFieldErrors(validInput)).toEqual({});
    expect(hasOAuthOnboardingFieldErrors(getOAuthOnboardingFieldErrors(validInput))).toBe(false);
  });

  it('requires displayName, phone and birthDate without email or password', () => {
    const errors = getOAuthOnboardingFieldErrors({
      displayName: '',
      phone: '',
      birthDate: '',
    });

    expect(errors).toEqual({
      displayName: 'required',
      phone: 'required',
      birthDate: 'required',
    });
  });

  it('validates phone and birthDate format', () => {
    const errors = getOAuthOnboardingFieldErrors({
      displayName: 'Maria',
      phone: '123',
      birthDate: '01/01/2030',
    });

    expect(errors).toEqual({
      phone: 'invalid_phone',
      birthDate: 'invalid_birth_date',
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

describe('validateOrganizationImageMime', () => {
  it('accepts png, jpeg and webp', () => {
    expect(validateOrganizationImageMime('image/png')).toBeNull();
    expect(validateOrganizationImageMime('image/jpeg')).toBeNull();
    expect(validateOrganizationImageMime('image/webp')).toBeNull();
  });

  it('rejects svg and other types', () => {
    expect(validateOrganizationImageMime('image/svg+xml')).toBe('unsupported_type');
    expect(validateOrganizationImageMime('application/pdf')).toBe('unsupported_type');
  });
});

describe('validateOrganizationImageDimensions', () => {
  it('accepts images with at least 200x200 px', () => {
    expect(validateOrganizationImageDimensions(200, 200)).toBeNull();
    expect(validateOrganizationImageDimensions(400, 300)).toBeNull();
  });

  it('rejects smaller images', () => {
    expect(validateOrganizationImageDimensions(199, 200)).toBe('too_small');
    expect(validateOrganizationImageDimensions(200, 180)).toBe('too_small');
  });
});
