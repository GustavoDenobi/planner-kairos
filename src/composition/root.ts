import { createAgendaUseCases } from '@/application/agenda';
import { createOfflineUseCases } from '@/application/offline';
import { createRepertoireUseCases } from '@/application/repertoire';
import { createEnsembleUseCases } from '@/application/ensemble';
import { createIdentityUseCases } from '@/application/identity';
import { createAuthGateway } from '@/infrastructure/supabase/auth-gateway';
import { createFileStorage } from '@/infrastructure/supabase/file-storage';
import { createEventRepository } from '@/infrastructure/supabase/event-repository';
import { createEventAbsenceRepository } from '@/infrastructure/supabase/event-absence-repository';
import { createEventTypeRepository } from '@/infrastructure/supabase/event-type-repository';
import { createGroupInviteRepository } from '@/infrastructure/supabase/group-invite-repository';
import { createAssignmentRepository } from '@/infrastructure/supabase/assignment-repository';
import { createGroupRepository } from '@/infrastructure/supabase/group-repository';
import { createMusicianRepository } from '@/infrastructure/supabase/musician-repository';
import { createMembershipRepository } from '@/infrastructure/supabase/membership-repository';
import { createOrganizationRepository } from '@/infrastructure/supabase/organization-repository';
import { createPartRepository } from '@/infrastructure/supabase/part-repository';
import { createPieceCategoryRepository } from '@/infrastructure/supabase/piece-category-repository';
import { createPieceFileAnnotationRepository } from '@/infrastructure/supabase/piece-file-annotation-repository';
import { createPieceFileRepository } from '@/infrastructure/supabase/piece-file-repository';
import { createPieceAccessRepository } from '@/infrastructure/supabase/piece-access-repository';
import { createPieceRepository } from '@/infrastructure/supabase/piece-repository';
import { createPieceThemeRepository } from '@/infrastructure/supabase/piece-theme-repository';
import { createSectionRepository } from '@/infrastructure/supabase/section-repository';
import { createPasswordRecoveryGateway } from '@/infrastructure/supabase/password-recovery-gateway';
import { createProfileRepository } from '@/infrastructure/supabase/profile-repository';
import { createReadingPlaylistRepository } from '@/infrastructure/supabase/reading-playlist-repository';
import { createOfflineStorage } from '@/infrastructure/pwa';

export function createAppServices() {
  const auth = createAuthGateway();
  const profileRepo = createProfileRepository();
  const orgRepo = createOrganizationRepository();
  const membershipRepo = createMembershipRepository();
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
  const pieceAccessRepo = createPieceAccessRepository();
  const pieceFileRepo = createPieceFileRepository();
  const annotationRepo = createPieceFileAnnotationRepository();
  const playlistRepo = createReadingPlaylistRepository();
  const eventTypeRepo = createEventTypeRepository();
  const eventRepo = createEventRepository();
  const eventAbsenceRepo = createEventAbsenceRepository();

  const identity = createIdentityUseCases({
    auth,
    profileRepo,
    orgRepo,
    membershipRepo,
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
    accessRepo: pieceAccessRepo,
    fileRepo: pieceFileRepo,
    annotationRepo,
    playlistRepo,
    partRepo,
    fileStorage,
  });

  const agenda = createAgendaUseCases({
    eventTypeRepo,
    eventRepo,
    eventAbsenceRepo,
    pieceRepo,
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    groupRepo,
  });

  const offlineStorage = createOfflineStorage();

  const offline = createOfflineUseCases({
    pieceRepo,
    fileRepo: pieceFileRepo,
    fileStorage,
    annotationRepo,
    playlistRepo,
    offlineStorage,
    eventRepo,
    eventTypeRepo,
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    groupRepo,
    partRepo,
    sectionRepo,
  });

  return { identity, ensemble, repertoire, agenda, offline };
}
