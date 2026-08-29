import { createAgendaUseCases } from '@/application/agenda';
import { createOfflineUseCases } from '@/application/offline';
import { createRepertoireUseCases } from '@/application/repertoire';
import { createEnsembleUseCases } from '@/application/ensemble';
import { createIdentityUseCases } from '@/application/identity';
import { createPlatformUseCases } from '@/application/platform';
import { createAuthGateway } from '@/infrastructure/supabase/auth-gateway';
import { createFileStorage } from '@/infrastructure/supabase/file-storage';
import { createPlatformAdminGateway } from '@/infrastructure/supabase/platform-admin-gateway';
import { createPlatformRepository } from '@/infrastructure/supabase/platform-repository';
import { createEventRepository } from '@/infrastructure/supabase/event-repository';
import { createEventRecurrenceRepository } from '@/infrastructure/supabase/event-recurrence-repository';
import { createEventAbsenceRepository } from '@/infrastructure/supabase/event-absence-repository';
import { createEventTypeRepository } from '@/infrastructure/supabase/event-type-repository';
import { createGroupInviteRepository } from '@/infrastructure/supabase/group-invite-repository';
import { createAssignmentRepository } from '@/infrastructure/supabase/assignment-repository';
import { createGroupRepository } from '@/infrastructure/supabase/group-repository';
import { createMusicianClaimRepository } from '@/infrastructure/supabase/musician-claim-repository';
import { createMusicianRepository } from '@/infrastructure/supabase/musician-repository';
import { createMembershipRepository } from '@/infrastructure/supabase/membership-repository';
import { createLegalAcceptanceRepository } from '@/infrastructure/supabase/legal-acceptance-repository';
import { createOrganizationRepository } from '@/infrastructure/supabase/organization-repository';
import { createPartRepository } from '@/infrastructure/supabase/part-repository';
import { createPieceCategoryRepository } from '@/infrastructure/supabase/piece-category-repository';
import { createPieceFileAnnotationRepository } from '@/infrastructure/supabase/piece-file-annotation-repository';
import { createAnnotationSetRepository } from '@/infrastructure/supabase/annotation-set-repository';
import { createPieceFileNavigationShortcutRepository } from '@/infrastructure/supabase/piece-file-navigation-shortcut-repository';
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
  const legalRepo = createLegalAcceptanceRepository();
  const inviteRepo = createGroupInviteRepository();
  const musicianClaimRepo = createMusicianClaimRepository();
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
  const annotationSetRepo = createAnnotationSetRepository();
  const navigationShortcutRepo = createPieceFileNavigationShortcutRepository();
  const playlistRepo = createReadingPlaylistRepository();
  const eventTypeRepo = createEventTypeRepository();
  const eventRepo = createEventRepository();
  const eventRecurrenceRepo = createEventRecurrenceRepository();
  const eventAbsenceRepo = createEventAbsenceRepository();

  const identity = createIdentityUseCases({
    auth,
    profileRepo,
    orgRepo,
    membershipRepo,
    inviteRepo,
    musicianClaimRepo,
    recoveryGateway,
    fileStorage,
    legalRepo,
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
    annotationSetRepo,
    navigationShortcutRepo,
    playlistRepo,
    partRepo,
    fileStorage,
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    orgRepo,
  });

  const agenda = createAgendaUseCases({
    eventTypeRepo,
    eventRepo,
    eventRecurrenceRepo,
    eventAbsenceRepo,
    pieceRepo,
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    groupRepo,
    orgRepo,
  });

  const offlineStorage = createOfflineStorage();
  const platformRepo = createPlatformRepository();
  const platformAdminGateway = createPlatformAdminGateway();

  const offline = createOfflineUseCases({
    pieceRepo,
    fileRepo: pieceFileRepo,
    fileStorage,
    annotationRepo,
    annotationSetRepo,
    navigationShortcutRepo,
    playlistRepo,
    offlineStorage,
    eventRepo,
    eventTypeRepo,
    membershipRepo,
    musicianRepo,
    assignmentRepo,
    groupRepo,
    orgRepo,
    partRepo,
    sectionRepo,
  });

  const platform = createPlatformUseCases({
    platformRepo,
    platformAdminGateway,
  });

  return { identity, ensemble, repertoire, agenda, offline, platform };
}
