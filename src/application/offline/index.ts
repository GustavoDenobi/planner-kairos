import type { FileStorage } from '@/application/ports/file-storage';
import type { OfflineAnnotationStore } from '@/application/ports/offline-annotation-store';
import type { OfflineNavigationShortcutStore } from '@/application/ports/offline-navigation-shortcut-store';
import type { OfflineFileCache } from '@/application/ports/offline-file-cache';
import type { OfflineIdentityStore } from '@/application/ports/offline-identity-store';
import type { OfflinePlaylistCache } from '@/application/ports/offline-playlist-cache';
import type { OfflineAgendaCache } from '@/application/ports/offline-agenda-cache';
import type { OfflineMusicianCache } from '@/application/ports/offline-musician-cache';
import type { OfflineOrgImageCache } from '@/application/ports/offline-org-image-cache';
import type { EventRepository } from '@/application/ports/event-repository';
import type { EventTypeRepository } from '@/application/ports/event-type-repository';
import type { AssignmentRepository } from '@/application/ports/assignment-repository';
import type { GroupRepository } from '@/application/ports/group-repository';
import type { PartRepository } from '@/application/ports/part-repository';
import type { SectionRepository } from '@/application/ports/section-repository';
import type { MembershipRepository } from '@/application/ports/membership-repository';
import type { MusicianRepository } from '@/application/ports/musician-repository';
import type { PieceFileAnnotationRepository } from '@/application/ports/piece-file-annotation-repository';
import type { PieceFileNavigationShortcutRepository } from '@/application/ports/piece-file-navigation-shortcut-repository';
import type { PieceFileRepository } from '@/application/ports/piece-file-repository';
import type { PieceRepository } from '@/application/ports/piece-repository';
import type { ReadingPlaylistRepository } from '@/application/ports/reading-playlist-repository';
import type {
  CreatePdfAnnotationInput,
  CreatePdfNavigationShortcutInput,
  UpdatePdfAnnotationInput,
  UpdatePdfNavigationShortcutInput,
} from '@/domain/repertoire';
import {
  createNavigationShortcutWithOffline,
  deleteNavigationShortcutWithOffline,
  listNavigationShortcutsForReading,
  reorderNavigationShortcutsWithOffline,
  syncPendingNavigationShortcutChanges,
  updateNavigationShortcutWithOffline,
} from './navigation-shortcut-offline-use-cases';
import {
  createAnnotationWithOffline,
  deleteAnnotationWithOffline,
  listAnnotationsForReading,
  updateAnnotationWithOffline,
} from './annotation-offline-use-cases';
import {
  cachePieceFileForOffline,
  estimatePlaylistCacheSize,
  getFileOfflineStatus,
  removeCachedPieceFile,
  resolvePieceFileForReading,
} from './file-cache-use-cases';
import {
  cacheReadingPlaylistForOffline,
  cacheUserReadingPlaylistsForOffline,
  getCachedReadingPlaylist,
  removeCachedPlaylist,
  syncPendingOfflineChanges,
} from './playlist-cache-use-cases';
import {
  clearIdentitySnapshot,
  findOrganizationBySlug,
  getIdentitySnapshot,
  saveIdentitySnapshot,
  sessionFromIdentitySnapshot,
  sessionFromOfflineSnapshot,
} from './identity-snapshot-use-cases';
import {
  cacheAgendaForOffline,
  getCachedAgendaMeta,
  getCachedAssociableAudience,
  getCachedEventDetail,
  getCachedEventTypes,
  listCachedEventsInRange,
} from './agenda-cache-use-cases';
import {
  cacheMusiciansForOffline,
  getCachedGroup,
  getCachedMusician,
  getCachedMusiciansFilterData,
  getCachedMusiciansMeta,
  getCachedSectionPartIdsByGroup,
  listCachedAssignmentsForGroup,
  listCachedAssignmentsForMusician,
  listCachedGroups,
  listCachedMusicians,
  listCachedSectionsForGroup,
} from './musician-cache-use-cases';
import {
  clearOrgImageMemoryCache,
  getCachedOrgImageObjectUrl,
  prefetchOrgImages,
  removeOrgImageFromCache,
  resolveOrgImageObjectUrl,
} from './org-image-cache-use-cases';
import type { CachePlaylistProgress } from './types';

export type OfflineStoragePorts = {
  fileCache: OfflineFileCache;
  annotationStore: OfflineAnnotationStore;
  navigationShortcutStore: OfflineNavigationShortcutStore;
  playlistCache: OfflinePlaylistCache;
  identityStore: OfflineIdentityStore;
  agendaCache: OfflineAgendaCache;
  musicianCache: OfflineMusicianCache;
  orgImageCache: OfflineOrgImageCache;
};

export type OfflineUseCaseDeps = {
  pieceRepo: PieceRepository;
  fileRepo: PieceFileRepository;
  fileStorage: FileStorage;
  annotationRepo: PieceFileAnnotationRepository;
  navigationShortcutRepo: PieceFileNavigationShortcutRepository;
  playlistRepo: ReadingPlaylistRepository;
  offlineStorage: OfflineStoragePorts;
  eventRepo: EventRepository;
  eventTypeRepo: EventTypeRepository;
  membershipRepo: MembershipRepository;
  musicianRepo: MusicianRepository;
  assignmentRepo: AssignmentRepository;
  groupRepo: GroupRepository;
  partRepo: PartRepository;
  sectionRepo: SectionRepository;
};

export function createOfflineUseCases(deps: OfflineUseCaseDeps) {
  const fileCache = deps.offlineStorage.fileCache;
  const annotationStore = deps.offlineStorage.annotationStore;
  const navigationShortcutStore = deps.offlineStorage.navigationShortcutStore;
  const playlistCache = deps.offlineStorage.playlistCache;
  const identityStore = deps.offlineStorage.identityStore;
  const agendaCache = deps.offlineStorage.agendaCache;
  const musicianCache = deps.offlineStorage.musicianCache;
  const orgImageCache = deps.offlineStorage.orgImageCache;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';

  return {
    cachePieceFileForOffline: (organizationId: string, pieceId: string, fileId: string) =>
      cachePieceFileForOffline(
        deps.pieceRepo,
        deps.fileRepo,
        deps.fileStorage,
        fileCache,
        organizationId,
        pieceId,
        fileId,
      ),

    cacheReadingPlaylistForOffline: (
      organizationId: string,
      playlistId: string,
      userId: string,
      onProgress?: (progress: CachePlaylistProgress) => void,
    ) =>
      cacheReadingPlaylistForOffline(
        deps.pieceRepo,
        deps.fileRepo,
        deps.fileStorage,
        fileCache,
        deps.playlistRepo,
        playlistCache,
        deps.annotationRepo,
        annotationStore,
        deps.navigationShortcutRepo,
        navigationShortcutStore,
        organizationId,
        playlistId,
        userId,
        onProgress,
      ),

    cacheUserReadingPlaylistsForOffline: (
      organizationId: string,
      userId: string,
      onProgress?: (progress: CachePlaylistProgress) => void,
    ) =>
      cacheUserReadingPlaylistsForOffline(
        deps.pieceRepo,
        deps.fileRepo,
        deps.fileStorage,
        fileCache,
        deps.playlistRepo,
        playlistCache,
        deps.annotationRepo,
        annotationStore,
        deps.navigationShortcutRepo,
        navigationShortcutStore,
        organizationId,
        userId,
        onProgress,
      ),

    resolvePieceFileForReading: (
      organizationId: string,
      pieceId: string,
      fileId: string,
    ) =>
      resolvePieceFileForReading(
        deps.pieceRepo,
        deps.fileRepo,
        deps.fileStorage,
        fileCache,
        organizationId,
        pieceId,
        fileId,
      ),

    listAnnotationsForReading: (organizationId: string, pieceFileId: string) =>
      listAnnotationsForReading(
        deps.annotationRepo,
        annotationStore,
        organizationId,
        pieceFileId,
      ),

    createPieceFileAnnotation: (
      organizationId: string,
      pieceId: string,
      authorUserId: string,
      input: CreatePdfAnnotationInput,
    ) =>
      createAnnotationWithOffline(
        deps.annotationRepo,
        annotationStore,
        organizationId,
        pieceId,
        authorUserId,
        input,
      ),

    deletePieceFileAnnotation: (
      organizationId: string,
      pieceFileId: string,
      annotationId: string,
    ) =>
      deleteAnnotationWithOffline(
        deps.annotationRepo,
        annotationStore,
        organizationId,
        pieceFileId,
        annotationId,
      ),

    updatePieceFileAnnotation: (
      organizationId: string,
      pieceFileId: string,
      annotationId: string,
      input: UpdatePdfAnnotationInput,
    ) =>
      updateAnnotationWithOffline(
        deps.annotationRepo,
        annotationStore,
        organizationId,
        pieceFileId,
        annotationId,
        input,
      ),

    listNavigationShortcutsForReading: (organizationId: string, pieceFileId: string) =>
      listNavigationShortcutsForReading(
        deps.navigationShortcutRepo,
        navigationShortcutStore,
        organizationId,
        pieceFileId,
      ),

    createPieceFileNavigationShortcut: (
      organizationId: string,
      pieceId: string,
      authorUserId: string,
      input: CreatePdfNavigationShortcutInput,
    ) =>
      createNavigationShortcutWithOffline(
        deps.navigationShortcutRepo,
        navigationShortcutStore,
        organizationId,
        pieceId,
        authorUserId,
        input,
      ),

    updatePieceFileNavigationShortcut: (
      organizationId: string,
      pieceFileId: string,
      shortcutId: string,
      input: UpdatePdfNavigationShortcutInput,
    ) =>
      updateNavigationShortcutWithOffline(
        deps.navigationShortcutRepo,
        navigationShortcutStore,
        organizationId,
        pieceFileId,
        shortcutId,
        input,
      ),

    deletePieceFileNavigationShortcut: (
      organizationId: string,
      pieceFileId: string,
      shortcutId: string,
    ) =>
      deleteNavigationShortcutWithOffline(
        deps.navigationShortcutRepo,
        navigationShortcutStore,
        organizationId,
        pieceFileId,
        shortcutId,
      ),

    reorderPieceFileNavigationShortcuts: (
      organizationId: string,
      pieceFileId: string,
      orderedIds: string[],
    ) =>
      reorderNavigationShortcutsWithOffline(
        deps.navigationShortcutRepo,
        navigationShortcutStore,
        organizationId,
        pieceFileId,
        orderedIds,
      ),

    getOfflineStatus: (
      organizationId: string,
      pieceId: string,
      fileId: string,
    ) =>
      getFileOfflineStatus(
        deps.fileRepo,
        fileCache,
        annotationStore,
        organizationId,
        pieceId,
        fileId,
      ),

    removeCachedPieceFile: (fileId: string) => removeCachedPieceFile(fileCache, fileId),

    removeCachedPlaylist: (playlistId: string) =>
      removeCachedPlaylist(playlistCache, fileCache, playlistId),

    getCachedReadingPlaylist: (playlistId: string) =>
      getCachedReadingPlaylist(playlistCache, playlistId),

    listCachedPlaylistsForOrganization: (organizationId: string) =>
      playlistCache.listForOrganization(organizationId),

    getIdentitySnapshot: () => getIdentitySnapshot(identityStore),

    saveIdentitySnapshot: (
      session: import('@/application/ports/auth-gateway').AuthSession,
      organizations: import('@/application/ports/organization-repository').OrganizationWithRole[],
      currentOrgSlug: string | null,
    ) => saveIdentitySnapshot(identityStore, session, organizations, currentOrgSlug),

    sessionFromIdentitySnapshot: sessionFromIdentitySnapshot,

    sessionFromOfflineSnapshot: sessionFromOfflineSnapshot,

    findOrganizationBySlug: findOrganizationBySlug,

    estimatePlaylistCacheSize: (organizationId: string, pieceFileIds: string[]) =>
      estimatePlaylistCacheSize(deps.fileRepo, organizationId, pieceFileIds),

    syncPendingOfflineChanges: async () => {
      const annotationResult = await syncPendingOfflineChanges(
        deps.annotationRepo,
        annotationStore,
      );
      const shortcutResult = await syncPendingNavigationShortcutChanges(
        deps.navigationShortcutRepo,
        navigationShortcutStore,
      );
      return {
        synced: annotationResult.synced + shortcutResult.synced,
        failed: annotationResult.failed + shortcutResult.failed,
      };
    },

    cacheAgendaForOffline: (organizationId: string, userId: string) =>
      cacheAgendaForOffline(
        deps.eventRepo,
        deps.eventTypeRepo,
        deps.membershipRepo,
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.groupRepo,
        agendaCache,
        organizationId,
        userId,
      ),

    listCachedEventsInRange: (
      organizationId: string,
      userId: string,
      options: import('./agenda-cache-use-cases').CachedEventsInRangeOptions,
    ) => listCachedEventsInRange(agendaCache, organizationId, userId, options),

    getCachedEventDetail: (organizationId: string, userId: string, eventId: string) =>
      getCachedEventDetail(agendaCache, organizationId, userId, eventId),

    getCachedEventTypes: (organizationId: string, userId: string) =>
      getCachedEventTypes(agendaCache, organizationId, userId),

    getCachedAssociableAudience: (organizationId: string, userId: string) =>
      getCachedAssociableAudience(agendaCache, organizationId, userId),

    getCachedAgendaMeta: (organizationId: string, userId: string) =>
      getCachedAgendaMeta(agendaCache, organizationId, userId),

    cacheMusiciansForOffline: (organizationId: string, userId: string) =>
      cacheMusiciansForOffline(
        deps.musicianRepo,
        deps.assignmentRepo,
        deps.groupRepo,
        deps.partRepo,
        deps.sectionRepo,
        musicianCache,
        organizationId,
        userId,
      ),

    listCachedMusicians: (
      organizationId: string,
      userId: string,
      options?: import('@/application/ports/musician-repository').ListMusiciansOptions,
    ) => listCachedMusicians(musicianCache, organizationId, userId, options),

    getCachedMusician: (organizationId: string, userId: string, musicianId: string) =>
      getCachedMusician(musicianCache, organizationId, userId, musicianId),

    listCachedAssignmentsForMusician: (
      organizationId: string,
      userId: string,
      musicianId: string,
    ) => listCachedAssignmentsForMusician(musicianCache, organizationId, userId, musicianId),

    getCachedMusiciansFilterData: (organizationId: string, userId: string) =>
      getCachedMusiciansFilterData(musicianCache, organizationId, userId),

    getCachedMusiciansMeta: (organizationId: string, userId: string) =>
      getCachedMusiciansMeta(musicianCache, organizationId, userId),

    listCachedGroups: (
      organizationId: string,
      userId: string,
      options?: import('./musician-cache-use-cases').ListCachedGroupsOptions,
    ) => listCachedGroups(musicianCache, organizationId, userId, options),

    getCachedGroup: (organizationId: string, userId: string, groupId: string) =>
      getCachedGroup(musicianCache, organizationId, userId, groupId),

    listCachedAssignmentsForGroup: (
      organizationId: string,
      userId: string,
      groupId: string,
    ) => listCachedAssignmentsForGroup(musicianCache, organizationId, userId, groupId),

    listCachedSectionsForGroup: (organizationId: string, userId: string, groupId: string) =>
      listCachedSectionsForGroup(musicianCache, organizationId, userId, groupId),

    getCachedSectionPartIdsByGroup: (organizationId: string, userId: string, groupId: string) =>
      getCachedSectionPartIdsByGroup(musicianCache, organizationId, userId, groupId),

    getCachedOrgImageObjectUrl: (storageKey: string) => getCachedOrgImageObjectUrl(storageKey),

    resolveOrgImageUrl: (storageKey: string) =>
      resolveOrgImageObjectUrl(orgImageCache, storageKey, supabaseUrl),

    prefetchOrgImages: (storageKeys: Array<string | null | undefined>) =>
      prefetchOrgImages(orgImageCache, storageKeys, supabaseUrl),

    removeOrgImageFromCache: (storageKey: string) =>
      removeOrgImageFromCache(orgImageCache, storageKey),

    clearAllOfflineData: async () => {
      clearOrgImageMemoryCache();
      await fileCache.clearAll();
      await annotationStore.clearAll();
      await navigationShortcutStore.clearAll();
      await playlistCache.clearAll();
      await agendaCache.clearAll();
      await musicianCache.clearAll();
      await orgImageCache.clearAll();
      await clearIdentitySnapshot(identityStore);
    },
  };
}

export type OfflineUseCases = ReturnType<typeof createOfflineUseCases>;

export type { CachePlaylistProgress, OfflineStatus, ResolvedPieceFile } from './types';
export type { OfflineFileStatus } from './types';
export type { CachedEventsInRangeOptions, CachedEventsInRangeResult } from './agenda-cache-use-cases';
export type { CachedMusiciansListResult, CachedGroupsListResult } from './musician-cache-use-cases';
