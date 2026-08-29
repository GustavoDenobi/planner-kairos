import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation, useNavigate, useParams } from 'react-router-dom';

import type { CreatePdfAnnotationInput, CreateAnnotationSetInput, CreatePdfNavigationShortcutInput, PdfAnnotation, PdfNavigationShortcut, PieceFileWithLinks, ReadingPlaylistDetail, UpdateAnnotationSetInput, UpdatePdfNavigationShortcutInput, AnnotationSet } from '@/domain/repertoire';

import { formatAnnotationSetLabel, resolveAnnotationSetAudience } from '@/domain/repertoire';

import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';

import type { AnnotationViewerContext } from '@/application/ports/offline-annotation-store';

import { useEnsemble, useOffline, useRepertoire, useAgenda } from '@/ui/app/AppServicesContext';

import { useAuth } from '@/ui/app/auth/AuthProvider';

import { useOrg } from '@/ui/app/OrgProvider';

import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';

import { BackLink } from '@/ui/components/BackButton';

import { PdfViewer, PdfViewerPlaylistNav, type DirectedSetOption, type SectionLeadOption } from '@/ui/features/repertoire/PdfViewer';

import { DirectedAnnotationSetModal } from '@/ui/features/repertoire/DirectedAnnotationSetModal';

import { DirectedAnnotationSetManageModal } from '@/ui/features/repertoire/DirectedAnnotationSetManageModal';

import { eventPath } from '@/ui/features/agenda/agenda-routes';

import { readingPlaylistErrorMessage } from '@/ui/features/repertoire/reading-playlist-labels';

import {

  isPlaylistItemAvailable,

  loadPlaylistItemData,

  PlaylistItemCache,

} from '@/ui/features/repertoire/playlist-reader-item-cache';

import {

  readingPlaylistEditPath,

  readingPlaylistReaderPath,

  readingPlaylistsPath,

} from '@/ui/features/repertoire/reading-playlist-routes';

import { ReaderLayout } from '@/ui/layouts/ReaderLayout';

import { readReturnTo } from '@/ui/navigation/return-to';

import { OfflineBanner } from '@/ui/features/pwa/OfflineBanner';

import {
  OfflineDownloadButton,
} from '@/ui/features/pwa/OfflineDownloadButton';

import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

import { resolveCanManageNavigationShortcuts } from '@/ui/features/repertoire/resolve-can-manage-navigation-shortcuts';

import type { AssignmentWithDetails } from '@/domain/ensemble';

import type { PartWithDivisions } from '@/application/ports/part-repository';

import { PieceAudioPickerModal } from '@/ui/features/repertoire/PieceAudioPickerModal';

import { PdfViewerInlineAudioBar } from '@/ui/features/repertoire/PdfViewerInlineAudioBar';

import { loadPieceViewerAudioContext } from '@/ui/features/repertoire/piece-viewer-audio';



type ReaderNavigationState = {

  initialPage?: number;

  direction?: 'next' | 'prev';

  sequential?: boolean;

  returnTo?: string;

};



function findNextAvailableIndex(

  playlist: ReadingPlaylistDetail,

  fromIndex: number,

): number | null {

  for (let index = fromIndex + 1; index < playlist.items.length; index += 1) {

    if (isPlaylistItemAvailable(playlist.items[index])) {

      return index;

    }

  }

  return null;

}



function findPreviousAvailableIndex(

  playlist: ReadingPlaylistDetail,

  fromIndex: number,

): number | null {

  for (let index = fromIndex - 1; index >= 0; index -= 1) {

    if (isPlaylistItemAvailable(playlist.items[index])) {

      return index;

    }

  }

  return null;

}



export function ReadingPlaylistReaderPage() {

  const { orgSlug, playlistId, itemIndex: itemIndexParam } = useParams();

  const navigate = useNavigate();

  const location = useLocation();

  const navState = (location.state as ReaderNavigationState | null) ?? {};

  const repertoire = useRepertoire();

  const offline = useOffline();

  const ensemble = useEnsemble();

  const agenda = useAgenda();

  const { userId } = useAuth();

  const { resolveOrgBySlug } = useOrg();

  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;

  const organizationId = org?.id;



  const itemIndex = Number.parseInt(itemIndexParam ?? '0', 10);

  const itemCacheRef = useRef(new PlaylistItemCache());

  const sequentialSkipRef = useRef<{ direction: 'next' | 'prev' } | null>(null);

  const sectionLeadsLoadedRef = useRef(false);



  const [playlist, setPlaylist] = useState<ReadingPlaylistDetail | null>(null);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);

  const [navigationShortcuts, setNavigationShortcuts] = useState<PdfNavigationShortcut[]>([]);

  const [canManageNavigationShortcuts, setCanManageNavigationShortcuts] = useState(false);

  const [sectionLeadOptions, setSectionLeadOptions] = useState<SectionLeadOption[]>([]);

  const [annotationSets, setAnnotationSets] = useState<AnnotationSet[]>([]);

  const [canEditDirectedLayer, setCanEditDirectedLayer] = useState(false);

  const [viewerContext, setViewerContext] = useState<AnnotationViewerContext | null>(null);

  const [associableGroups, setAssociableGroups] = useState<Array<{ id: string; name: string; kind: import('@/domain/ensemble').GroupKind }>>([]);

  const [associableMusicians, setAssociableMusicians] = useState<Array<{ id: string; name: string; partNames?: string[] }>>([]);

  const [directedSetModalOpen, setDirectedSetModalOpen] = useState(false);
  const [directedSetManageModalOpen, setDirectedSetManageModalOpen] = useState(false);
  const [directedSetModalMode, setDirectedSetModalMode] = useState<'create' | 'edit'>('create');
  const [directedSetSelectRequest, setDirectedSetSelectRequest] = useState<{ id: string; nonce: number } | null>(null);
  const [manageHighlightedSetId, setManageHighlightedSetId] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(true);

  const [isLoadingItem, setIsLoadingItem] = useState(true);

  useLoadingBar('reading-playlist-reader', isLoadingPlaylist || isLoadingItem);

  const [error, setError] = useState<string | null>(null);

  const [skipUnavailable, setSkipUnavailable] = useState(false);

  const [isCachedLocally, setIsCachedLocally] = useState(false);

  const online = useOnlineStatus();

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';

  const [accessibleAudios, setAccessibleAudios] = useState<PieceFileWithLinks[]>([]);

  const [audioParts, setAudioParts] = useState<PartWithDivisions[]>([]);

  const [audioPickerOpen, setAudioPickerOpen] = useState(false);

  const [activeAudio, setActiveAudio] = useState<PieceFileWithLinks | null>(null);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);



  const currentItem = playlist?.items[itemIndex] ?? null;

  const cachedCurrentItem = itemCacheRef.current.get(itemIndex);



  const backTo = useMemo(() => {

    if (!orgSlug || !playlistId) {

      return readingPlaylistsPath(orgSlug ?? '');

    }

    if (!online) {

      return readingPlaylistsPath(orgSlug);

    }

    if (playlist?.sourceEventId) {

      return eventPath(orgSlug, playlist.sourceEventId);

    }

    return readingPlaylistEditPath(orgSlug, playlistId);

  }, [orgSlug, playlistId, playlist?.sourceEventId, online]);



  const loadPlaylist = useCallback(async () => {

    if (!organizationId || !userId || !playlistId) {

      setIsLoadingPlaylist(false);

      return null;

    }



    if (!isBrowserOnline()) {

      const cached = await offline.getCachedReadingPlaylist(playlistId);

      if (cached) {

        setPlaylist(cached);

        setIsLoadingPlaylist(false);

        return cached;

      }

      setError('Playlist não disponível offline. Com conexão, as partituras são salvas automaticamente neste dispositivo.');

      setPlaylist(null);

      setIsLoadingPlaylist(false);

      return null;

    }



    const result = await repertoire.getReadingPlaylist(organizationId, playlistId, userId);

    if (!result.ok) {

      const cached = await offline.getCachedReadingPlaylist(playlistId);

      if (cached) {

        setPlaylist(cached);

        setIsLoadingPlaylist(false);

        return cached;

      }

      setError(readingPlaylistErrorMessage(result.error));

      setPlaylist(null);

      setIsLoadingPlaylist(false);

      return null;

    }



    setPlaylist(result.value);

    setIsLoadingPlaylist(false);

    void offline.cacheReadingPlaylistForOffline(organizationId, playlistId, userId);

    return result.value;

  }, [organizationId, userId, playlistId, repertoire, offline]);



  useEffect(() => {

    sectionLeadsLoadedRef.current = false;

    itemCacheRef.current = new PlaylistItemCache();

    setIsLoadingPlaylist(true);

    setError(null);

    void loadPlaylist();

  }, [org?.id, playlistId, userId, loadPlaylist]);



  const loadSectionLeads = useCallback(async () => {

    if (!organizationId || !userId || sectionLeadsLoadedRef.current) {

      return;

    }



    const musicianResult = await ensemble.getMyMusician(organizationId, userId);

    const assignmentsResult = musicianResult.ok
      ? await ensemble.listAssignmentsForMusician(organizationId, musicianResult.value.id)
      : null;

    if (!musicianResult.ok) {
      setViewerContext({ userId, myMusicianId: null, memberGroupIds: [] });
      return;
    }

    if (!assignmentsResult?.ok) {
      setViewerContext({ userId, myMusicianId: musicianResult.value.id, memberGroupIds: [] });
      return;
    }



    const leads: SectionLeadOption[] = [];

    const seen = new Set<string>();

    for (const assignment of assignmentsResult.value) {

      if (

        assignment.ensembleRole !== 'section_lead' ||

        !assignment.sectionId ||

        seen.has(assignment.sectionId)

      ) {

        continue;

      }

      seen.add(assignment.sectionId);

      leads.push({

        id: assignment.sectionId,

        name: assignment.sectionName ?? 'Naipe',

      });

    }

    setSectionLeadOptions(leads);

    setViewerContext({
      userId,
      myMusicianId: musicianResult.value.id,
      memberGroupIds: [...new Set(assignmentsResult.value.map((assignment) => assignment.groupId))],
    });

    sectionLeadsLoadedRef.current = true;

  }, [organizationId, userId, ensemble]);



  const loadItemAtIndex = useCallback(

    async (index: number, options?: { showLoading?: boolean }) => {

      if (!organizationId || !playlist) {

        return null;

      }



      const item = playlist.items[index];

      if (!item) {

        return null;

      }



      if (!isPlaylistItemAvailable(item)) {

        setDownloadUrl(null);

        setAnnotations([]);

        setNavigationShortcuts([]);

        setSkipUnavailable(true);

        setIsLoadingItem(false);

        return null;

      }



      const cached = itemCacheRef.current.get(index);

      if (cached) {

        setDownloadUrl(cached.downloadUrl);

        setAnnotations(cached.annotations);

        setNavigationShortcuts(cached.navigationShortcuts);

        setIsCachedLocally(cached.isCachedLocally);

        setSkipUnavailable(false);

        setIsLoadingItem(false);

        return cached;

      }



      if (options?.showLoading !== false) {

        setIsLoadingItem(true);

      }

      setSkipUnavailable(false);



      const result = await itemCacheRef.current.load(index, () =>

        loadPlaylistItemData(offline, organizationId, item, viewerContext ?? undefined),

      );



      if (!result) {

        setDownloadUrl(null);

        setAnnotations([]);

        setSkipUnavailable(false);

        setError(

          online

            ? 'Não foi possível abrir esta partitura. Verifique a conexão e tente novamente.'

            : 'Não foi possível abrir a partitura salva neste dispositivo.',

        );

        setIsLoadingItem(false);

        return null;

      }



      setDownloadUrl(result.downloadUrl);

      setAnnotations(result.annotations);

      if (viewerContext) {
        const setsResult = await offline.listAnnotationSetsForReading(
          organizationId,
          item.pieceFileId,
          viewerContext,
        );
        if (setsResult.ok) {
          setAnnotationSets(setsResult.value);
        }
      }

      setNavigationShortcuts(result.navigationShortcuts);

      setIsCachedLocally(result.isCachedLocally);

      setSkipUnavailable(false);

      setIsLoadingItem(false);

      return result;

    },

    [organizationId, playlist, offline, online, viewerContext],

  );



  useEffect(() => {

    if (!playlist || !organizationId) {

      return;

    }



    if (itemIndex < 0 || itemIndex >= playlist.items.length) {

      setError('Item não encontrado na playlist. Volte e selecione outra partitura.');

      setIsLoadingItem(false);

      return;

    }



    sequentialSkipRef.current = navState.sequential

      ? { direction: navState.direction ?? 'next' }

      : null;



    async function load() {

      setError(null);

      if (online) {

        void loadSectionLeads();

      }



      const hasCachedItem = Boolean(itemCacheRef.current.get(itemIndex));

      await loadItemAtIndex(itemIndex, { showLoading: !hasCachedItem });

    }



    void load();

  }, [

    playlist,

    org?.id,

    loadItemAtIndex,

    loadSectionLeads,

    online,

    navState.sequential,

    navState.direction,

  ]);



  useEffect(() => {

    if (!playlist || !organizationId) {

      return;

    }



    for (const offset of [-1, 1]) {

      const index = itemIndex + offset;

      if (index < 0 || index >= playlist.items.length) {

        continue;

      }

      const item = playlist.items[index];

      if (!isPlaylistItemAvailable(item)) {

        continue;

      }

      itemCacheRef.current.prefetch(index, () =>
        loadPlaylistItemData(offline, organizationId, item, viewerContext ?? undefined),
      );

    }

  }, [playlist, organizationId, itemIndex, offline]);



  const goToItem = useCallback(

    (

      index: number,

      options?: {

        page?: number;

        direction?: 'next' | 'prev';

        sequential?: boolean;

      },

    ) => {

      if (!orgSlug || !playlistId) {

        return;

      }

      const returnTo = readReturnTo(location.state);

      navigate(readingPlaylistReaderPath(orgSlug, playlistId, index), {

        state: {

          initialPage: options?.page,

          direction: options?.direction,

          sequential: options?.sequential,

          ...(returnTo ? { returnTo } : {}),

        },

        replace: true,

      });

    },

    [navigate, orgSlug, playlistId, location.state],

  );



  const continueToNextItem = useCallback(() => {

    if (!playlist) {

      return;

    }

    const nextIndex = findNextAvailableIndex(playlist, itemIndex);

    if (nextIndex === null) {

      return;

    }

    goToItem(nextIndex, {

      page: 1,

      direction: 'next',

      sequential: true,

    });

  }, [playlist, itemIndex, goToItem]);



  const continueToPreviousItem = useCallback(async () => {

    if (!playlist || !organizationId) {

      return;

    }

    const previousIndex = findPreviousAvailableIndex(playlist, itemIndex);

    if (previousIndex === null) {

      return;

    }



    const cached = await itemCacheRef.current.load(previousIndex, () =>

      loadPlaylistItemData(
        offline,
        organizationId,
        playlist.items[previousIndex],
        viewerContext ?? undefined,
      ),

    );

    const lastPage = cached?.numPages ?? 1;



    goToItem(previousIndex, {

      page: lastPage,

      direction: 'prev',

      sequential: true,

    });

  }, [playlist, organizationId, itemIndex, goToItem, offline]);



  useEffect(() => {

    if (!skipUnavailable || !sequentialSkipRef.current || !playlist) {

      return;

    }



    const { direction } = sequentialSkipRef.current;

    sequentialSkipRef.current = null;



    if (direction === 'next') {

      const nextIndex = findNextAvailableIndex(playlist, itemIndex);

      if (nextIndex !== null) {

        goToItem(nextIndex, {

          page: 1,

          direction: 'next',

          sequential: true,

        });

      }

      return;

    }



    const previousIndex = findPreviousAvailableIndex(playlist, itemIndex);

    if (previousIndex !== null) {

      void continueToPreviousItem();

    }

  }, [skipUnavailable, playlist, itemIndex, goToItem, continueToPreviousItem]);



  useEffect(() => {

    if (!organizationId || !currentItem?.pieceId || !online) {

      setAccessibleAudios([]);

      setAudioParts([]);

      setActiveAudio(null);

      setAudioUrl(null);

      return;

    }



    let cancelled = false;



    void loadPieceViewerAudioContext({

      repertoire,

      ensemble,

      organizationId,

      pieceId: currentItem.pieceId,

      isAdmin,

      userId,

      online,

    }).then((context) => {

      if (cancelled) {

        return;

      }

      setAccessibleAudios(context?.audios ?? []);

      setAudioParts(context?.parts ?? []);

      setActiveAudio(null);

      setAudioUrl(null);

    });



    return () => {

      cancelled = true;

    };

  }, [organizationId, currentItem?.pieceId, online, isAdmin, userId, repertoire, ensemble]);



  const handleSelectAudio = useCallback(

    async (selected: PieceFileWithLinks) => {

      if (!organizationId || !currentItem?.pieceId) {

        return;

      }



      setActiveAudio(selected);

      setAudioUrl(null);



      const result = await repertoire.getPieceFileDownloadUrl(

        organizationId,

        currentItem.pieceId,

        selected.id,

      );

      if (!result.ok) {

        setActiveAudio(null);

        return;

      }



      setAudioUrl(result.value);

    },

    [organizationId, currentItem?.pieceId, repertoire],

  );



  const handleCloseAudio = useCallback(() => {

    setActiveAudio(null);

    setAudioUrl(null);

  }, []);



  const handleAnnotationCreate = useCallback(

    async (input: Omit<CreatePdfAnnotationInput, 'pieceFileId'>) => {

      if (!organizationId || !userId || !currentItem?.pieceId) {

        return null;

      }

      if (!online && (input.layer === 'section' || input.layer === 'directed')) {

        return null;

      }

      const result = await offline.createPieceFileAnnotation(

        organizationId,

        currentItem.pieceId,

        userId,

        {

          ...input,

          pieceFileId: currentItem.pieceFileId,

        },

      );



      if (!result.ok) {

        return null;

      }



      setAnnotations((current) => [...current, result.value]);

      return result.value;

    },

    [organizationId, userId, currentItem, offline, online],

  );



  const handleAnnotationDelete = useCallback(

    async (annotationId: string) => {

      if (!organizationId || !currentItem) {

        return;

      }



      const result = await offline.deletePieceFileAnnotation(

        organizationId,

        currentItem.pieceFileId,

        annotationId,

      );

      if (!result.ok) {

        return;

      }



      setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));

    },

    [organizationId, currentItem, offline],

  );



  useEffect(() => {

    if (!organizationId || !userId) {

      setCanEditDirectedLayer(false);

      setAssociableGroups([]);

      setAssociableMusicians([]);

      return;

    }

    const resolvedOrganizationId = organizationId;
    const resolvedUserId = userId;

    async function loadAudience() {

      const audienceResult = online

        ? await agenda.listAssociableAudience(resolvedOrganizationId, resolvedUserId)

        : null;

      const cachedAudience = online

        ? null

        : await offline.getCachedAssociableAudience(resolvedOrganizationId, resolvedUserId);



      if (audienceResult?.ok) {

        setCanEditDirectedLayer(isAdmin || audienceResult.value.isGroupWriter);

        setAssociableGroups(audienceResult.value.groups);

        setAssociableMusicians(

          audienceResult.value.musicians.map((musician) => ({

            id: musician.id,

            name: musician.name,

            partNames: musician.partNames,

          })),

        );

      } else if (cachedAudience) {

        setCanEditDirectedLayer(isAdmin || cachedAudience.isGroupWriter);

        setAssociableGroups(cachedAudience.groups);

        setAssociableMusicians(

          cachedAudience.musicians.map((musician) => ({

            id: musician.id,

            name: musician.name,

            partNames: musician.partNames,

          })),

        );

      }

    }



    void loadAudience();

  }, [organizationId, userId, online, agenda, offline, isAdmin]);



  const audienceLookup = useMemo(
    () => ({
      groups: associableGroups,
      musicians: associableMusicians.map((musician) => ({
        id: musician.id,
        name: musician.name,
      })),
    }),
    [associableGroups, associableMusicians],
  );

  const directedSetOptions = useMemo((): DirectedSetOption[] => {

    return annotationSets.map((set) => ({

      id: set.id,

      label: formatAnnotationSetLabel(resolveAnnotationSetAudience(set, audienceLookup)),

      canEdit: Boolean(userId && set.authorUserId === userId),

    }));

  }, [annotationSets, userId, audienceLookup]);

  const editingSet = editingSetId
    ? annotationSets.find((set) => set.id === editingSetId) ?? null
    : null;

  const editableAnnotationSets = useMemo(
    () => annotationSets.filter((set) => Boolean(userId && set.authorUserId === userId)),
    [annotationSets, userId],
  );

  const openDirectedSetCreate = useCallback(() => {
    setDirectedSetManageModalOpen(false);
    setDirectedSetModalMode('create');
    setEditingSetId(null);
    setDirectedSetModalOpen(true);
  }, []);

  const openDirectedSetEdit = useCallback((set: AnnotationSet) => {
    setDirectedSetManageModalOpen(false);
    setDirectedSetModalMode('edit');
    setEditingSetId(set.id);
    setDirectedSetModalOpen(true);
  }, []);

  const handleDirectedSetDelete = useCallback(
    async (setId: string) => {
      if (!organizationId || !currentItem?.pieceFileId) {
        return false;
      }

      const result = await offline.deleteAnnotationSet(
        organizationId,
        currentItem.pieceFileId,
        setId,
      );
      if (!result.ok) {
        return false;
      }

      setAnnotationSets((current) => current.filter((set) => set.id !== setId));
      setAnnotations((current) =>
        current.filter((annotation) => annotation.annotationSetId !== setId),
      );
      if (editingSetId === setId) {
        setEditingSetId(null);
        setDirectedSetModalOpen(false);
      }
      return true;
    },
    [organizationId, currentItem, offline, editingSetId],
  );

  const handleDirectedSetSubmit = useCallback(

    async (input: CreateAnnotationSetInput | UpdateAnnotationSetInput) => {

      if (!organizationId || !userId || !currentItem?.pieceId) {

        return false;

      }

      if (directedSetModalMode === 'create') {
        const result = await offline.createAnnotationSet(
          organizationId,
          currentItem.pieceId,
          userId,
          {
            ...(input as CreateAnnotationSetInput),
            pieceFileId: currentItem.pieceFileId,
          },
          audienceLookup,
        );

        if (!result.ok) {
          return false;
        }

        setAnnotationSets((current) => [...current, result.value]);
        setDirectedSetSelectRequest({ id: result.value.id, nonce: Date.now() });
        return true;
      }

      if (!editingSetId) {
        return false;
      }

      const result = await offline.updateAnnotationSet(organizationId, editingSetId, input);
      if (!result.ok) {
        return false;
      }

      setAnnotationSets((current) =>
        current.map((set) => (set.id === editingSetId ? result.value : set)),
      );
      return true;

    },

    [organizationId, userId, currentItem, offline, audienceLookup, directedSetModalMode, editingSetId],

  );



  useEffect(() => {

    if (!organizationId || !userId || !currentItem?.pieceId) {

      setCanManageNavigationShortcuts(false);

      return;

    }

    const resolvedOrganizationId = organizationId;
    const resolvedUserId = userId;
    const pieceId = currentItem.pieceId;

    if (isAdmin) {

      setCanManageNavigationShortcuts(true);

      return;

    }



    let cancelled = false;



    async function loadManageAccess() {

      const pieceResult = await repertoire.getPiece(resolvedOrganizationId, pieceId);

      if (cancelled || !pieceResult.ok) {

        setCanManageNavigationShortcuts(false);

        return;

      }



      const musicianResult = await ensemble.getMyMusician(resolvedOrganizationId, resolvedUserId);

      let assignments: AssignmentWithDetails[] = [];

      if (musicianResult.ok) {

        const assignmentsResult = await ensemble.listAssignmentsForMusician(

          resolvedOrganizationId,

          musicianResult.value.id,

        );

        if (assignmentsResult.ok) {

          assignments = assignmentsResult.value;

        }

      }



      const sectionPartIds = new Set<string>();

      for (const assignment of assignments) {

        if (assignment.ensembleRole !== 'section_lead' || !assignment.sectionId) {

          continue;

        }

        const cachedPartIdsMap = online

          ? null

          : await offline.getCachedSectionPartIdsByGroup(

              resolvedOrganizationId,

              resolvedUserId,

              assignment.groupId,

            );

        if (cachedPartIdsMap) {

          for (const partId of cachedPartIdsMap.get(assignment.sectionId) ?? []) {

            sectionPartIds.add(partId);

          }

        } else if (online) {

          const partIdsResult = await ensemble.listSectionPartIdsByGroup(

            resolvedOrganizationId,

            assignment.groupId,

          );

          if (partIdsResult.ok) {

            for (const partId of partIdsResult.value.get(assignment.sectionId) ?? []) {

              sectionPartIds.add(partId);

            }

          }

        }

      }



      if (!cancelled) {

        setCanManageNavigationShortcuts(

          resolveCanManageNavigationShortcuts({

            isAdmin: false,

            assignments,

            pieceGroupIds: pieceResult.value.groups.map((group) => group.id),

            filePartLinks: currentItem!.partLinks,

            sectionPartIdsBySectionLead: [...sectionPartIds],

          }),

        );

      }

    }



    void loadManageAccess();



    return () => {

      cancelled = true;

    };

  }, [organizationId, userId, currentItem, isAdmin, online, repertoire, ensemble, offline]);



  const handleNavigationShortcutCreate = useCallback(

    async (input: Omit<CreatePdfNavigationShortcutInput, 'pieceFileId'>) => {

      if (!organizationId || !userId || !currentItem?.pieceId) {

        return null;

      }



      const result = await offline.createPieceFileNavigationShortcut(

        organizationId,

        currentItem.pieceId,

        userId,

        {

          ...input,

          pieceFileId: currentItem.pieceFileId,

        },

      );



      if (!result.ok) {

        return null;

      }



      setNavigationShortcuts((current) =>

        [...current.filter((item) => item.id !== result.value.id), result.value].sort(

          (a, b) => a.sortOrder - b.sortOrder,

        ),

      );

      return result.value;

    },

    [organizationId, userId, currentItem, offline],

  );



  const handleNavigationShortcutUpdate = useCallback(

    async (shortcutId: string, input: UpdatePdfNavigationShortcutInput) => {

      if (!organizationId || !currentItem) {

        return null;

      }



      const result = await offline.updatePieceFileNavigationShortcut(

        organizationId,

        currentItem.pieceFileId,

        shortcutId,

        input,

      );



      if (!result.ok) {

        return null;

      }



      setNavigationShortcuts((current) =>

        current

          .map((item) => (item.id === shortcutId ? result.value : item))

          .sort((a, b) => a.sortOrder - b.sortOrder),

      );

      return result.value;

    },

    [organizationId, currentItem, offline],

  );



  const handleNavigationShortcutDelete = useCallback(

    async (shortcutId: string) => {

      if (!organizationId || !currentItem) {

        return;

      }



      const result = await offline.deletePieceFileNavigationShortcut(

        organizationId,

        currentItem.pieceFileId,

        shortcutId,

      );

      if (!result.ok) {

        return;

      }



      setNavigationShortcuts((current) => current.filter((item) => item.id !== shortcutId));

    },

    [organizationId, currentItem, offline],

  );



  const handleNavigationShortcutReorder = useCallback(

    async (orderedIds: string[]) => {

      if (!organizationId || !currentItem) {

        return;

      }



      const result = await offline.reorderPieceFileNavigationShortcuts(

        organizationId,

        currentItem.pieceFileId,

        orderedIds,

      );



      if (result.ok) {

        setNavigationShortcuts(result.value);

      }

    },

    [organizationId, currentItem, offline],

  );



  if (!orgSlug || !playlistId || !itemIndexParam) {

    return null;

  }



  const showBlockingLoading = (isLoadingPlaylist || isLoadingItem) && !cachedCurrentItem;



  if (showBlockingLoading) {

    return (

      <ReaderLayout title="Carregando…" backTo={backTo} subtitle={playlist?.name}>

        <p className="p-4 text-sm text-muted">Carregando partitura…</p>

      </ReaderLayout>

    );

  }



  if (error || !playlist || !currentItem) {

    return (

      <ReaderLayout title="Erro" backTo={backTo} subtitle={playlist?.name}>

        <div className="space-y-4 p-4">

          <p className="text-sm text-red-600">{error ?? 'Não foi possível abrir a partitura.'}</p>

          <BackLink

            fallbackTo={backTo}

            className="text-sm font-medium text-primary hover:underline"

          >

            Voltar

          </BackLink>

        </div>

      </ReaderLayout>

    );

  }



  if (skipUnavailable && !navState.sequential) {

    return (

      <ReaderLayout

        title={currentItem.fileTitle}

        backTo={backTo}

        subtitle={playlist.name}

      >

        <div className="space-y-4 p-4">

          <p className="text-sm text-muted">

            Esta partitura não está disponível (obra removida ou arquivo indisponível).

          </p>

          {findNextAvailableIndex(playlist, itemIndex) !== null ? (

            <button

              type="button"

              onClick={() => {

                const nextIndex = findNextAvailableIndex(playlist, itemIndex);

                if (nextIndex !== null) {

                  goToItem(nextIndex);

                }

              }}

              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"

            >

              Próxima obra

            </button>

          ) : (

            <BackLink

              fallbackTo={backTo}

              className="text-sm font-medium text-primary hover:underline"

            >

              Voltar

            </BackLink>

          )}

        </div>

      </ReaderLayout>

    );

  }



  if (!downloadUrl && !cachedCurrentItem?.pdfDocument) {

    return (

      <ReaderLayout title="Erro" backTo={backTo} subtitle={playlist.name}>

        <p className="p-4 text-sm text-red-600">Não foi possível carregar o arquivo.</p>

      </ReaderLayout>

    );

  }



  const displayTitle = currentItem.label ?? currentItem.fileTitle;

  const previousAvailableIndex = findPreviousAvailableIndex(playlist, itemIndex);

  const nextAvailableIndex = findNextAvailableIndex(playlist, itemIndex);



  const playlistContext = {

    title: playlist.name,

    currentIndex: itemIndex,

    totalItems: playlist.items.length,

    currentItemLabel: displayTitle,

    canGoPrevious: previousAvailableIndex !== null,

    canGoNext: nextAvailableIndex !== null,

    onPreviousItem: () => {

      if (previousAvailableIndex !== null) {

        goToItem(previousAvailableIndex);

      }

    },

    onGoNextItem: () => {

      if (nextAvailableIndex !== null) {

        goToItem(nextAvailableIndex);

      }

    },

    onContinueToPreviousItem: () => {

      void continueToPreviousItem();

    },

    onContinueToNextItem: continueToNextItem,

  };



  return (

    <ReaderLayout

      backTo={backTo}

      downloadUrl={downloadUrl}

      downloadName={currentItem.fileTitle}

      offlineBanner={<OfflineBanner isCached={isCachedLocally} />}

      headerActions={

        org && currentItem.pieceId ? (

          <OfflineDownloadButton

            organizationId={org.id}

            pieceId={currentItem.pieceId}

            fileId={currentItem.pieceFileId}

            allowRemove={false}

          />

        ) : null

      }

      centerContent={

        <PdfViewerPlaylistNav

          playlist={playlistContext}

          onPrevious={playlistContext.onPreviousItem}

          onNext={playlistContext.onGoNextItem}

        />

      }

    >

      <PdfViewer

        key={currentItem.pieceFileId}

        url={downloadUrl ?? ''}

        userId={userId}

        annotations={annotations}

        sectionLeadOptions={sectionLeadOptions}

        directedSetOptions={directedSetOptions}

        canEditDirectedLayer={canEditDirectedLayer}

        directedSetSelectRequest={directedSetSelectRequest}

        onManageDirectedSet={(context) => {
          setManageHighlightedSetId(context?.activeDirectedSetId ?? null);
          setDirectedSetManageModalOpen(true);
        }}

        playlist={playlistContext}

        initialPage={navState.initialPage ?? 1}

        entryDirection={navState.direction}

        preloadedPdf={cachedCurrentItem?.pdfDocument ?? null}

        audioPicker={{

          visible: online && accessibleAudios.length > 0,

          onOpenPicker: () => setAudioPickerOpen(true),

        }}

        inlineAudioBar={

          activeAudio && audioUrl ? (

            <PdfViewerInlineAudioBar

              url={audioUrl}

              onClose={handleCloseAudio}

            />

          ) : null

        }

        onAnnotationCreate={handleAnnotationCreate}

        onAnnotationDelete={handleAnnotationDelete}

        navigationShortcuts={navigationShortcuts}

        canManageNavigationShortcuts={canManageNavigationShortcuts}

        onNavigationShortcutCreate={handleNavigationShortcutCreate}

        onNavigationShortcutUpdate={handleNavigationShortcutUpdate}

        onNavigationShortcutDelete={handleNavigationShortcutDelete}

        onNavigationShortcutReorder={handleNavigationShortcutReorder}

      />



      {organizationId && currentItem && (
        <>
          <DirectedAnnotationSetManageModal
            open={directedSetManageModalOpen}
            sets={editableAnnotationSets}
            audienceLookup={audienceLookup}
            highlightedSetId={manageHighlightedSetId}
            onClose={() => {
              setDirectedSetManageModalOpen(false);
              setManageHighlightedSetId(null);
            }}
            onCreate={openDirectedSetCreate}
            onEdit={openDirectedSetEdit}
            onDelete={handleDirectedSetDelete}
          />
          <DirectedAnnotationSetModal
            open={directedSetModalOpen}
            mode={directedSetModalMode}
            groups={associableGroups}
            musicians={associableMusicians}
            initialSet={editingSet}
            disabled={!online && directedSetModalMode === 'create'}
            onClose={() => {
              setDirectedSetModalOpen(false);
              setEditingSetId(null);
            }}
            onSubmit={handleDirectedSetSubmit}
          />
        </>
      )}



      <PieceAudioPickerModal

        open={audioPickerOpen}

        onClose={() => setAudioPickerOpen(false)}

        files={accessibleAudios}

        parts={audioParts}

        onSelect={(selected) => {

          void handleSelectAudio(selected);

        }}

      />

    </ReaderLayout>

  );

}

