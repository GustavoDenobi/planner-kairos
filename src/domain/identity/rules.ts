import type { AccessRole } from './membership';
import type { GroupInvite } from './group-invite';
import type { PasswordRecoveryCode } from './password-recovery-code';
import { isValidEmailFormat, isValidPhoneFormat } from '@/domain/ensemble';

export const INVITE_SIGNUP_MIN_PASSWORD_LENGTH = 6;

export type InviteSignupField = 'displayName' | 'email' | 'phone' | 'birthDate' | 'password';

export type InviteSignupFieldErrorCode =
  | 'required'
  | 'invalid_email'
  | 'invalid_phone'
  | 'invalid_birth_date'
  | 'password_too_short';

export type InviteSignupFieldErrors = Partial<
  Record<InviteSignupField, InviteSignupFieldErrorCode>
>;

export type InviteSignupInput = {
  displayName: string;
  email: string;
  phone: string;
  birthDate: string;
  password: string;
};

export function parseInviteBirthDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return toValidIsoDate(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return toValidIsoDate(brMatch[3], brMatch[2], brMatch[1]);
  }

  return null;
}

function toValidIsoDate(year: string, month: string, day: string): string | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const parsed = new Date(y, m - 1, d);

  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
    return null;
  }

  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isValidInviteBirthDate(birthDate: string): boolean {
  const iso = parseInviteBirthDate(birthDate);
  if (!iso) {
    return false;
  }

  const parsed = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed <= today;
}

export function normalizeInviteBirthDate(birthDate: string): string | null {
  if (!isValidInviteBirthDate(birthDate)) {
    return null;
  }

  return parseInviteBirthDate(birthDate);
}

export function getInviteSignupFieldErrors(input: InviteSignupInput): InviteSignupFieldErrors {
  const errors: InviteSignupFieldErrors = {};

  if (!input.displayName.trim()) {
    errors.displayName = 'required';
  }

  if (!input.email.trim()) {
    errors.email = 'required';
  } else if (!isValidEmailFormat(input.email)) {
    errors.email = 'invalid_email';
  }

  if (!input.phone.trim()) {
    errors.phone = 'required';
  } else if (!isValidPhoneFormat(input.phone)) {
    errors.phone = 'invalid_phone';
  }

  if (!input.birthDate.trim()) {
    errors.birthDate = 'required';
  } else if (!isValidInviteBirthDate(input.birthDate)) {
    errors.birthDate = 'invalid_birth_date';
  }

  if (!input.password) {
    errors.password = 'required';
  } else if (input.password.length < INVITE_SIGNUP_MIN_PASSWORD_LENGTH) {
    errors.password = 'password_too_short';
  }

  return errors;
}

export function hasInviteSignupFieldErrors(errors: InviteSignupFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function isValidInviteSignupPassword(password: string): boolean {
  return password.length >= INVITE_SIGNUP_MIN_PASSWORD_LENGTH;
}

export function isGroupInviteExhausted(maxUses: number, useCount: number): boolean {
  return maxUses > 0 && useCount >= maxUses;
}

export function isGroupInviteValid(invite: GroupInvite, now: Date, useCount: number): boolean {
  return (
    invite.revokedAt === null &&
    invite.expiresAt > now &&
    !isGroupInviteExhausted(invite.maxUses, useCount)
  );
}

export function canRedeemGroupInvite(
  invite: GroupInvite,
  now: Date,
  useCount: number,
  existingMusicianInOrg: boolean,
): boolean {
  if (!isGroupInviteValid(invite, now, useCount)) {
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

export const MIN_ORGANIZATION_IMAGE_SIZE = 200;

export const ORGANIZATION_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type OrganizationImageErrorCode = 'unsupported_type' | 'too_small' | 'unreadable';

export function validateOrganizationImageMime(mimeType: string): OrganizationImageErrorCode | null {
  if (!(ORGANIZATION_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return 'unsupported_type';
  }

  return null;
}

export function validateOrganizationImageDimensions(
  width: number,
  height: number,
): OrganizationImageErrorCode | null {
  if (width < MIN_ORGANIZATION_IMAGE_SIZE || height < MIN_ORGANIZATION_IMAGE_SIZE) {
    return 'too_small';
  }

  return null;
}
