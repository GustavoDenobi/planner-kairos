import type {
  AuthGateway,
  GroupInviteRepository,
  ProfileRepository,
} from '@/application/ports';
import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import { normalizePhone } from '@/domain/ensemble';
import {
  getInviteSignupFieldErrors,
  hasInviteSignupFieldErrors,
  isOrganizationRulesAccepted,
  isPlatformLegalAccepted,
  normalizeInviteBirthDate,
  type InviteSignupFieldErrors,
} from '@/domain/identity';
import {
  organizationRulesRequireAcceptance,
  type OrganizationRules,
} from '@/domain/identity/legal-documents';
import { Result } from '@/domain/shared';
import { recordOrganizationRulesAcceptance } from './record-organization-rules-acceptance';
import { recordPlatformLegalAcceptances } from './record-platform-legal-acceptances';

export type AcceptGroupInviteInput = {
  token: string;
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  birthDate?: string;
  isNewUser: boolean;
  userId?: string;
  platformLegalAccepted?: boolean;
  organizationRulesAccepted?: boolean;
  organizationId?: string;
  organizationRules?: OrganizationRules | null;
};

export type AcceptGroupInviteError =
  | InviteSignupFieldErrors
  | 'signup_failed'
  | 'email_taken'
  | 'invalid_invite'
  | 'not_authenticated'
  | 'platform_legal_not_accepted'
  | 'organization_rules_not_accepted'
  | string;

async function ensureOrganizationRulesAccepted(
  legalRepo: LegalAcceptanceRepository,
  input: {
    userId: string;
    organizationId: string;
    organizationRules: OrganizationRules | null | undefined;
    organizationRulesAccepted?: boolean;
  },
): Promise<AcceptGroupInviteError | null> {
  if (!organizationRulesRequireAcceptance(input.organizationRules)) {
    return null;
  }

  const rules = input.organizationRules;
  const alreadyAccepted = await legalRepo.hasAcceptedVersion(
    input.userId,
    'organization',
    'organization_rules',
    String(rules.version),
    input.organizationId,
  );

  if (alreadyAccepted) {
    return null;
  }

  if (!isOrganizationRulesAccepted(input.organizationRulesAccepted ?? false)) {
    return 'organization_rules_not_accepted';
  }

  return null;
}

export async function acceptGroupInvite(
  auth: AuthGateway,
  inviteRepo: GroupInviteRepository,
  profileRepo: ProfileRepository,
  legalRepo: LegalAcceptanceRepository,
  input: AcceptGroupInviteInput,
) {
  if (input.isNewUser) {
    if (!isPlatformLegalAccepted(input.platformLegalAccepted ?? false)) {
      return Result.fail('platform_legal_not_accepted' as AcceptGroupInviteError);
    }

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

    if (
      organizationRulesRequireAcceptance(input.organizationRules) &&
      !isOrganizationRulesAccepted(input.organizationRulesAccepted ?? false)
    ) {
      return Result.fail('organization_rules_not_accepted' as AcceptGroupInviteError);
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
    await recordPlatformLegalAcceptances(legalRepo, session.user.id, 'invite');

    if (
      organizationRulesRequireAcceptance(input.organizationRules) &&
      input.organizationId
    ) {
      await recordOrganizationRulesAcceptance(legalRepo, {
        userId: session.user.id,
        organizationId: input.organizationId,
        rulesVersion: input.organizationRules!.version,
        context: 'invite',
      });
    }

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

  const rulesError = await ensureOrganizationRulesAccepted(legalRepo, {
    userId: input.userId,
    organizationId: input.organizationId ?? '',
    organizationRules: input.organizationRules,
    organizationRulesAccepted: input.organizationRulesAccepted,
  });

  if (rulesError) {
    return Result.fail(rulesError);
  }

  if (
    organizationRulesRequireAcceptance(input.organizationRules) &&
    input.organizationId &&
    !(await legalRepo.hasAcceptedVersion(
      input.userId,
      'organization',
      'organization_rules',
      String(input.organizationRules!.version),
      input.organizationId,
    ))
  ) {
    await recordOrganizationRulesAcceptance(legalRepo, {
      userId: input.userId,
      organizationId: input.organizationId,
      rulesVersion: input.organizationRules!.version,
      context: 'invite',
    });
  }

  try {
    const orgSlug = await inviteRepo.redeem(input.token);
    return Result.ok({ organizationSlug: orgSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'redeem_failed';
    return Result.fail(message);
  }
}
