import { createEnsembleUseCases } from '@/application/ensemble';
import { createIdentityUseCases } from '@/application/identity';
import { createAuthGateway } from '@/infrastructure/supabase/auth-gateway';
import { createFileStorage } from '@/infrastructure/supabase/file-storage';
import { createGroupInviteRepository } from '@/infrastructure/supabase/group-invite-repository';
import { createGroupRepository } from '@/infrastructure/supabase/group-repository';
import { createOrganizationRepository } from '@/infrastructure/supabase/organization-repository';
import { createPasswordRecoveryGateway } from '@/infrastructure/supabase/password-recovery-gateway';
import { createProfileRepository } from '@/infrastructure/supabase/profile-repository';

export function createAppServices() {
  const auth = createAuthGateway();
  const profileRepo = createProfileRepository();
  const orgRepo = createOrganizationRepository();
  const inviteRepo = createGroupInviteRepository();
  const recoveryGateway = createPasswordRecoveryGateway();
  const fileStorage = createFileStorage();
  const groupRepo = createGroupRepository();

  const identity = createIdentityUseCases({
    auth,
    profileRepo,
    orgRepo,
    inviteRepo,
    recoveryGateway,
    fileStorage,
  });

  const ensemble = createEnsembleUseCases({ groupRepo });

  return { identity, ensemble };
}
