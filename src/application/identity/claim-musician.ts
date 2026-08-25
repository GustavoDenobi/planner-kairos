import type { AuthGateway, ProfileRepository } from '@/application/ports';
import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { MusicianClaimRepository } from '@/application/ports/musician-claim-repository';
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

export type ClaimMusicianInput = {
  musicianId: string;
  displayName: string;
  email: string;
  password: string;
  phone?: string;
  birthDate?: string;
  isNewUser: boolean;
  userId?: string;
  platformLegalAccepted?: boolean;
  organizationRulesAccepted?: boolean;
  organizationId?: string;
  organizationRules?: OrganizationRules | null;
};

export type ClaimMusicianError =
  | InviteSignupFieldErrors
  | 'signup_failed'
  | 'email_taken'
  | 'not_found'
  | 'already_claimed'
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
): Promise<ClaimMusicianError | null> {
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

export async function claimMusician(
  auth: AuthGateway,
  claimRepo: MusicianClaimRepository,
  profileRepo: ProfileRepository,
  legalRepo: LegalAcceptanceRepository,
  input: ClaimMusicianInput,
) {
  if (input.isNewUser) {
    if (!isPlatformLegalAccepted(input.platformLegalAccepted ?? false)) {
      return Result.fail('platform_legal_not_accepted' as ClaimMusicianError);
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
      return Result.fail('organization_rules_not_accepted' as ClaimMusicianError);
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
    await recordPlatformLegalAcceptances(legalRepo, session.user.id, 'musician_claim');

    if (
      organizationRulesRequireAcceptance(input.organizationRules) &&
      input.organizationId
    ) {
      await recordOrganizationRulesAcceptance(legalRepo, {
        userId: session.user.id,
        organizationId: input.organizationId,
        rulesVersion: input.organizationRules!.version,
        context: 'musician_claim',
      });
    }

    try {
      const normalizedBirthDate = normalizeInviteBirthDate(input.birthDate ?? '');
      const orgSlug = await claimRepo.claim(input.musicianId, {
        displayName: input.displayName.trim(),
        phone: normalizePhone(input.phone ?? ''),
        birthDate: normalizedBirthDate ?? undefined,
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
      context: 'musician_claim',
    });
  }

  if (!input.displayName.trim()) {
    return Result.fail({ displayName: 'required' } satisfies InviteSignupFieldErrors);
  }

  try {
    const normalizedBirthDate = input.birthDate
      ? normalizeInviteBirthDate(input.birthDate)
      : undefined;
    const orgSlug = await claimRepo.claim(input.musicianId, {
      displayName: input.displayName.trim(),
      phone: input.phone ? normalizePhone(input.phone) : undefined,
      birthDate: normalizedBirthDate ?? undefined,
    });
    await profileRepo.updateDisplayName(input.userId, input.displayName.trim());
    return Result.ok({ organizationSlug: orgSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'claim_failed';
    return Result.fail(message);
  }
}
