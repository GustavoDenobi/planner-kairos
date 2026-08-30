import type { AuthGateway } from '@/application/ports';
import type { ProfileRepository } from '@/application/ports';
import type { OrganizationRepository } from '@/application/ports';
import type { GroupInviteRepository } from '@/application/ports';
import type { PasswordRecoveryGateway } from '@/application/ports';
import type { FileStorage } from '@/application/ports';
import type { LegalAcceptanceRepository } from '@/application/ports/legal-acceptance-repository';

import type { AccessRole } from '@/domain/identity';
import { grantOrgAdmin } from './grant-org-admin';
import { revokeOrgAdmin } from './revoke-org-admin';
import { getMembershipAccessRole } from './get-membership-access-role';
import { acceptGroupInvite } from './accept-group-invite';
import { claimMusician } from './claim-musician';
import { confirmPasswordRecovery } from './confirm-password-recovery';
import { createGroupInvite } from './create-group-invite';
import { getPendingLegalAcceptances } from './get-pending-legal-acceptances';
import { listGroupInvites } from './list-group-invites';
import { listMyOrganizations } from './list-my-organizations';
import { getUserOrganizationRulesAcceptance } from './get-user-organization-rules-acceptance';
import { previewGroupInvite } from './preview-group-invite';
import { previewMusicianClaim } from './preview-musician-claim';
import { recordPendingLegalAcceptances } from './record-pending-legal-acceptances';
import { removeOrganizationImage } from './remove-organization-image';
import { requestPasswordRecovery } from './request-password-recovery';
import { revokeGroupInvite } from './revoke-group-invite';
import { setCurrentOrganization } from './set-current-organization';
import { setOrganizationImage } from './set-organization-image';
import { setOrganizationName } from './set-organization-name';
import { getOrganizationRules, setOrganizationRules } from './set-organization-rules';
import { setThemePreference } from './set-theme-preference';
import { signIn } from './sign-in';
import { signInWithGoogle } from './sign-in-with-google';
import { signOut } from './sign-out';
import {
  clearOAuthPendingContext,
  readOAuthPendingContext,
  type OAuthPendingContext,
} from './oauth-pending-context';
import { resumeOAuthPendingAction } from './resume-oauth-pending-action';
import { updateGroupInviteExpires } from './update-group-invite-expires';
import { updateGroupInviteMaxUses } from './update-group-invite-max-uses';

import type { MembershipRepository } from '@/application/ports';
import type { MusicianClaimRepository } from '@/application/ports/musician-claim-repository';

export type IdentityDeps = {
  auth: AuthGateway;
  profileRepo: ProfileRepository;
  orgRepo: OrganizationRepository;
  membershipRepo: MembershipRepository;
  inviteRepo: GroupInviteRepository;
  musicianClaimRepo: MusicianClaimRepository;
  recoveryGateway: PasswordRecoveryGateway;
  fileStorage: FileStorage;
  legalRepo: LegalAcceptanceRepository;
};

export function createIdentityUseCases(deps: IdentityDeps) {
  return {
    signIn: (email: string, password: string) => signIn(deps.auth, { email, password }),
    signInWithGoogle: (context: OAuthPendingContext) => signInWithGoogle(deps.auth, context),
    signOut: () => signOut(deps.auth),
    listMyOrganizations: (userId: string) => listMyOrganizations(deps.orgRepo, userId),
    isPlatformAdmin: (userId: string) => deps.orgRepo.isPlatformAdmin(userId),
    setCurrentOrganization: (userId: string, slug: string) =>
      setCurrentOrganization(deps.orgRepo, userId, slug),
    setThemePreference: (userId: string, theme: 'light' | 'dark') =>
      setThemePreference(deps.profileRepo, userId, theme),
    setOrganizationImage: (
      organizationId: string,
      file: File,
      currentImageKey: string | null,
    ) => setOrganizationImage(deps.orgRepo, deps.fileStorage, organizationId, file, currentImageKey),
    removeOrganizationImage: (organizationId: string, currentImageKey: string | null) =>
      removeOrganizationImage(deps.orgRepo, deps.fileStorage, organizationId, currentImageKey),
    setOrganizationName: (organizationId: string, name: string) =>
      setOrganizationName(deps.orgRepo, organizationId, name),
    getOrganizationRules: (organizationId: string) =>
      getOrganizationRules(deps.orgRepo, organizationId),
    setOrganizationRules: (input: Parameters<typeof setOrganizationRules>[1]) =>
      setOrganizationRules(deps.orgRepo, input),
    previewGroupInvite: (token: string) => previewGroupInvite(deps.inviteRepo, token),
    previewMusicianClaim: (musicianId: string) =>
      previewMusicianClaim(deps.musicianClaimRepo, musicianId),
    claimMusician: (input: Parameters<typeof claimMusician>[4]) =>
      claimMusician(deps.auth, deps.musicianClaimRepo, deps.profileRepo, deps.legalRepo, input),
    createGroupInvite: (groupId: string, expiresAt: Date, maxUses = 0) =>
      createGroupInvite(deps.inviteRepo, groupId, expiresAt, maxUses),
    revokeGroupInvite: (inviteId: string) => revokeGroupInvite(deps.inviteRepo, inviteId),
    updateGroupInviteExpires: (inviteId: string, expiresAt: Date) =>
      updateGroupInviteExpires(deps.inviteRepo, inviteId, expiresAt),
    updateGroupInviteMaxUses: (inviteId: string, maxUses: number) =>
      updateGroupInviteMaxUses(deps.inviteRepo, inviteId, maxUses),
    listGroupInvites: (organizationId: string) =>
      listGroupInvites(deps.inviteRepo, organizationId),
    acceptGroupInvite: (input: Parameters<typeof acceptGroupInvite>[4]) =>
      acceptGroupInvite(
        deps.auth,
        deps.inviteRepo,
        deps.profileRepo,
        deps.legalRepo,
        input,
      ),
    getPendingLegalAcceptances: (userId: string, orgSlug?: string | null) =>
      getPendingLegalAcceptances(deps.legalRepo, deps.orgRepo, userId, orgSlug),
    recordPendingLegalAcceptances: (userId: string, pending: Parameters<typeof recordPendingLegalAcceptances>[2]) =>
      recordPendingLegalAcceptances(deps.legalRepo, userId, pending),
    getUserOrganizationRulesAcceptance: (organizationId: string, targetUserId: string | null) =>
      getUserOrganizationRulesAcceptance(deps.legalRepo, deps.orgRepo, organizationId, targetUserId),
    requestPasswordRecovery: (email: string) =>
      requestPasswordRecovery(deps.recoveryGateway, email),
    confirmPasswordRecovery: (email: string, code: string, newPassword: string) =>
      confirmPasswordRecovery(deps.recoveryGateway, email, code, newPassword),
    getProfile: (userId: string) => deps.profileRepo.getById(userId),
    getOrganizationBySlug: (slug: string) => deps.orgRepo.getBySlug(slug),
    getMembershipAccessRole: (organizationId: string, userId: string) =>
      getMembershipAccessRole(deps.membershipRepo, organizationId, userId),
    grantOrgAdmin: (
      actorUserId: string,
      actorAccessRole: AccessRole,
      organizationId: string,
      targetUserId: string,
    ) =>
      grantOrgAdmin(
        deps.membershipRepo,
        actorUserId,
        actorAccessRole,
        organizationId,
        targetUserId,
      ),
    revokeOrgAdmin: (
      actorUserId: string,
      actorAccessRole: AccessRole,
      organizationId: string,
      targetUserId: string,
    ) =>
      revokeOrgAdmin(
        deps.membershipRepo,
        actorUserId,
        actorAccessRole,
        organizationId,
        targetUserId,
      ),
    getSignedUrl: (path: string) => deps.fileStorage.getSignedUrl(path),
    getSession: () => deps.auth.getSession(),
    readOAuthPendingContext: () => readOAuthPendingContext(),
    clearOAuthPendingContext: () => clearOAuthPendingContext(),
    resumeOAuthPendingAction: (context: OAuthPendingContext, userId: string) =>
      resumeOAuthPendingAction(
        {
          inviteRepo: deps.inviteRepo,
          claimRepo: deps.musicianClaimRepo,
          profileRepo: deps.profileRepo,
          legalRepo: deps.legalRepo,
        },
        context,
        userId,
      ),
    onAuthStateChange: (cb: Parameters<AuthGateway['onAuthStateChange']>[0]) =>
      deps.auth.onAuthStateChange(cb),
  };
}

export type IdentityUseCases = ReturnType<typeof createIdentityUseCases>;

export type { OAuthPendingContext } from './oauth-pending-context';
