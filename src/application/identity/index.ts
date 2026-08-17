import type { AuthGateway } from '@/application/ports';
import type { ProfileRepository } from '@/application/ports';
import type { OrganizationRepository } from '@/application/ports';
import type { GroupInviteRepository } from '@/application/ports';
import type { PasswordRecoveryGateway } from '@/application/ports';
import type { FileStorage } from '@/application/ports';

import { acceptGroupInvite } from './accept-group-invite';
import { confirmPasswordRecovery } from './confirm-password-recovery';
import { createGroupInvite } from './create-group-invite';
import { listGroupInvites } from './list-group-invites';
import { listMyOrganizations } from './list-my-organizations';
import { previewGroupInvite } from './preview-group-invite';
import { removeOrganizationImage } from './remove-organization-image';
import { requestPasswordRecovery } from './request-password-recovery';
import { revokeGroupInvite } from './revoke-group-invite';
import { setCurrentOrganization } from './set-current-organization';
import { setOrganizationImage } from './set-organization-image';
import { setOrganizationName } from './set-organization-name';
import { setThemePreference } from './set-theme-preference';
import { signIn } from './sign-in';
import { signOut } from './sign-out';
import { updateGroupInviteExpires } from './update-group-invite-expires';

export type IdentityDeps = {
  auth: AuthGateway;
  profileRepo: ProfileRepository;
  orgRepo: OrganizationRepository;
  inviteRepo: GroupInviteRepository;
  recoveryGateway: PasswordRecoveryGateway;
  fileStorage: FileStorage;
};

export function createIdentityUseCases(deps: IdentityDeps) {
  return {
    signIn: (email: string, password: string) => signIn(deps.auth, { email, password }),
    signOut: () => signOut(deps.auth),
    listMyOrganizations: (userId: string) => listMyOrganizations(deps.orgRepo, userId),
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
    previewGroupInvite: (token: string) => previewGroupInvite(deps.inviteRepo, token),
    createGroupInvite: (groupId: string, expiresAt: Date) =>
      createGroupInvite(deps.inviteRepo, groupId, expiresAt),
    revokeGroupInvite: (inviteId: string) => revokeGroupInvite(deps.inviteRepo, inviteId),
    updateGroupInviteExpires: (inviteId: string, expiresAt: Date) =>
      updateGroupInviteExpires(deps.inviteRepo, inviteId, expiresAt),
    listGroupInvites: (organizationId: string) =>
      listGroupInvites(deps.inviteRepo, organizationId),
    acceptGroupInvite: (input: Parameters<typeof acceptGroupInvite>[3]) =>
      acceptGroupInvite(deps.auth, deps.inviteRepo, deps.profileRepo, input),
    requestPasswordRecovery: (email: string) =>
      requestPasswordRecovery(deps.recoveryGateway, email),
    confirmPasswordRecovery: (email: string, code: string, newPassword: string) =>
      confirmPasswordRecovery(deps.recoveryGateway, email, code, newPassword),
    getProfile: (userId: string) => deps.profileRepo.getById(userId),
    getOrganizationBySlug: (slug: string) => deps.orgRepo.getBySlug(slug),
    getSignedUrl: (path: string) => deps.fileStorage.getSignedUrl(path),
    getSession: () => deps.auth.getSession(),
    onAuthStateChange: (cb: Parameters<AuthGateway['onAuthStateChange']>[0]) =>
      deps.auth.onAuthStateChange(cb),
  };
}

export type IdentityUseCases = ReturnType<typeof createIdentityUseCases>;
