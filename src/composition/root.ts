import { createRepertoireUseCases } from '@/application/repertoire';
import { createEnsembleUseCases } from '@/application/ensemble';
import { createIdentityUseCases } from '@/application/identity';
import { createAuthGateway } from '@/infrastructure/supabase/auth-gateway';
import { createFileStorage } from '@/infrastructure/supabase/file-storage';
import { createGroupInviteRepository } from '@/infrastructure/supabase/group-invite-repository';
import { createAssignmentRepository } from '@/infrastructure/supabase/assignment-repository';
import { createGroupRepository } from '@/infrastructure/supabase/group-repository';
import { createMusicianRepository } from '@/infrastructure/supabase/musician-repository';
import { createOrganizationRepository } from '@/infrastructure/supabase/organization-repository';
import { createPartRepository } from '@/infrastructure/supabase/part-repository';
import { createPieceCategoryRepository } from '@/infrastructure/supabase/piece-category-repository';
import { createPieceFileRepository } from '@/infrastructure/supabase/piece-file-repository';
import { createPieceRepository } from '@/infrastructure/supabase/piece-repository';
import { createPieceThemeRepository } from '@/infrastructure/supabase/piece-theme-repository';
import { createSectionRepository } from '@/infrastructure/supabase/section-repository';
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
  const musicianRepo = createMusicianRepository();
  const partRepo = createPartRepository();
  const sectionRepo = createSectionRepository();
  const assignmentRepo = createAssignmentRepository();
  const categoryRepo = createPieceCategoryRepository();
  const themeRepo = createPieceThemeRepository();
  const pieceRepo = createPieceRepository();
  const pieceFileRepo = createPieceFileRepository();

  const identity = createIdentityUseCases({
    auth,
    profileRepo,
    orgRepo,
    inviteRepo,
    recoveryGateway,
    fileStorage,
  });

  const ensemble = createEnsembleUseCases({
    groupRepo,
    musicianRepo,
    partRepo,
    sectionRepo,
    assignmentRepo,
  });

  const repertoire = createRepertoireUseCases({
    categoryRepo,
    themeRepo,
    pieceRepo,
    fileRepo: pieceFileRepo,
    partRepo,
    fileStorage,
  });

  return { identity, ensemble, repertoire };
}
