import type {
  GroupInviteRepository,
  ProfileRepository,
} from '@/application/ports';
import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';
import type { MusicianClaimRepository } from '@/application/ports/musician-claim-repository';
import { normalizePhone } from '@/domain/ensemble';
import {
  isOrganizationRulesAccepted,
  isPlatformLegalAccepted,
  normalizeInviteBirthDate,
  organizationRulesRequireAcceptance,
} from '@/domain/identity';
import {
  type OAuthPendingContext,
  type ResumeOAuthPendingActionResult,
} from './oauth-pending-context';
import { recordOrganizationRulesAcceptance } from './record-organization-rules-acceptance';
import { recordPlatformLegalAcceptances } from './record-platform-legal-acceptances';

export type ResumeOAuthPendingActionDeps = {
  inviteRepo: GroupInviteRepository;
  claimRepo: MusicianClaimRepository;
  profileRepo: ProfileRepository;
  legalRepo: LegalAcceptanceRepository;
};

export async function resumeOAuthPendingAction(
  deps: ResumeOAuthPendingActionDeps,
  context: OAuthPendingContext,
  userId: string,
): Promise<ResumeOAuthPendingActionResult> {
  switch (context.kind) {
    case 'login':
      return { ok: true, redirectTo: '/orgs' };

    case 'invite_login':
      return { ok: true, redirectTo: context.returnPath };

    case 'musician_login':
      return { ok: true, redirectTo: context.returnPath };

    case 'invite_signup':
      return finishInviteSignup(deps, context, userId);

    case 'musician_signup':
      return finishMusicianSignup(deps, context, userId);
  }
}

async function finishInviteSignup(
  deps: ResumeOAuthPendingActionDeps,
  context: Extract<OAuthPendingContext, { kind: 'invite_signup' }>,
  userId: string,
): Promise<ResumeOAuthPendingActionResult> {
  if (
    organizationRulesRequireAcceptance(context.organizationRules) &&
    !isOrganizationRulesAccepted(context.organizationRulesAccepted ?? false)
  ) {
    return {
      ok: false,
      error: 'organization_rules_not_accepted',
      redirectTo: context.fallbackPath,
    };
  }

  await recordPlatformLegalAcceptances(deps.legalRepo, userId, 'invite');

  if (
    organizationRulesRequireAcceptance(context.organizationRules) &&
    context.organizationId
  ) {
    await recordOrganizationRulesAcceptance(deps.legalRepo, {
      userId,
      organizationId: context.organizationId,
      rulesVersion: context.organizationRules!.version,
      context: 'invite',
    });
  }

  await deps.profileRepo.updateDisplayName(userId, context.displayName.trim());

  try {
    const orgSlug = await deps.inviteRepo.redeem(context.token, {
      phone: normalizePhone(context.phone),
      birthDate: normalizeInviteBirthDate(context.birthDate) ?? undefined,
    });
    return { ok: true, redirectTo: `/${orgSlug}/agenda` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'redeem_failed';
    return { ok: false, error: message, redirectTo: context.fallbackPath };
  }
}

async function finishMusicianSignup(
  deps: ResumeOAuthPendingActionDeps,
  context: Extract<OAuthPendingContext, { kind: 'musician_signup' }>,
  userId: string,
): Promise<ResumeOAuthPendingActionResult> {
  if (
    organizationRulesRequireAcceptance(context.organizationRules) &&
    !isOrganizationRulesAccepted(context.organizationRulesAccepted ?? false)
  ) {
    return {
      ok: false,
      error: 'organization_rules_not_accepted',
      redirectTo: context.fallbackPath,
    };
  }

  await recordPlatformLegalAcceptances(deps.legalRepo, userId, 'musician_claim');

  if (
    organizationRulesRequireAcceptance(context.organizationRules) &&
    context.organizationId
  ) {
    await recordOrganizationRulesAcceptance(deps.legalRepo, {
      userId,
      organizationId: context.organizationId,
      rulesVersion: context.organizationRules!.version,
      context: 'musician_claim',
    });
  }

  await deps.profileRepo.updateDisplayName(userId, context.displayName.trim());

  try {
    const normalizedBirthDate = normalizeInviteBirthDate(context.birthDate);
    const orgSlug = await deps.claimRepo.claim(context.musicianId, {
      displayName: context.displayName.trim(),
      phone: normalizePhone(context.phone),
      birthDate: normalizedBirthDate ?? undefined,
    });
    return { ok: true, redirectTo: `/${orgSlug}/agenda` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'claim_failed';
    return { ok: false, error: message, redirectTo: context.fallbackPath };
  }
}

export function validateOAuthInviteSignupLegal(
  platformLegalAccepted: boolean,
  organizationRulesAccepted: boolean,
  requiresOrgRules: boolean,
): string | null {
  if (!isPlatformLegalAccepted(platformLegalAccepted)) {
    return 'platform_legal_not_accepted';
  }

  if (requiresOrgRules && !isOrganizationRulesAccepted(organizationRulesAccepted)) {
    return 'organization_rules_not_accepted';
  }

  return null;
}
