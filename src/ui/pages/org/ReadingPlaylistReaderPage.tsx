import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useLocation, useNavigate, useParams } from 'react-router-dom';

import type { CreatePdfAnnotationInput, PdfAnnotation, PieceFileWithLinks, ReadingPlaylistDetail } from '@/domain/repertoire';

import { isBrowserOnline } from '@/application/offline/file-cache-use-cases';

import { useEnsemble, useOffline, useRepertoire } from '@/ui/app/AppServicesContext';

import { useAuth } from '@/ui/app/auth/AuthProvider';

import { useOrg } from '@/ui/app/OrgProvider';

import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';

import { BackLink } from '@/ui/components/BackButton';

import { PdfViewer, PdfViewerPlaylistNav, type SectionLeadOption } from '@/ui/features/repertoire/PdfViewer';

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

  OfflineFileStatusBadge,

} from '@/ui/features/pwa/OfflineDownloadButton';

import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

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

  const { userId } = useAuth();

  const { resolveOrgBySlug } = useOrg();

  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;



  const itemIndex = Number.parseInt(itemIndexParam ?? '0', 10);

  const itemCacheRef = useRef(new PlaylistItemCache());

  const sequentialSkipRef = useRef<{ direction: 'next' | 'prev' } | null>(null);

  const sectionLeadsLoadedRef = useRef(false);



  const [playlist, setPlaylist] = useState<ReadingPlaylistDetail | null>(null);

  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);

  const [sectionLeadOptions, setSectionLeadOptions] = useState<SectionLeadOption[]>([]);

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

    if (!org || !userId || !playlistId) {

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



    const result = await repertoire.getReadingPlaylist(org.id, playlistId, userId);

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

    void offline.cacheReadingPlaylistForOffline(org.id, playlistId, userId);

    return result.value;

  }, [org, userId, playlistId, repertoire, offline]);



  useEffect(() => {

    sectionLeadsLoadedRef.current = false;

    itemCacheRef.current = new PlaylistItemCache();

    setIsLoadingPlaylist(true);

    setError(null);

    void loadPlaylist();

  }, [org?.id, playlistId, userId, loadPlaylist]);



  const loadSectionLeads = useCallback(async () => {

    if (!org || !userId || sectionLeadsLoadedRef.current) {

      return;

    }



    const musicianResult = await ensemble.getMyMusician(org.id, userId);

    if (!musicianResult.ok) {

      return;

    }



    const assignmentsResult = await ensemble.listAssignmentsForMusician(

      org.id,

      musicianResult.value.id,

    );

    if (!assignmentsResult.ok) {

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

    sectionLeadsLoadedRef.current = true;

  }, [org, userId, ensemble]);



  const loadItemAtIndex = useCallback(

    async (index: number, options?: { showLoading?: boolean }) => {

      if (!org || !playlist) {

        return null;

      }



      const item = playlist.items[index];

      if (!item) {

        return null;

      }



      if (!isPlaylistItemAvailable(item)) {

        setDownloadUrl(null);

        setAnnotations([]);

        setSkipUnavailable(true);

        setIsLoadingItem(false);

        return null;

      }



      const cached = itemCacheRef.current.get(index);

      if (cached) {

        setDownloadUrl(cached.downloadUrl);

        setAnnotations(cached.annotations);

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

        loadPlaylistItemData(offline, org.id, item),

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

      setIsCachedLocally(result.isCachedLocally);

      setSkipUnavailable(false);

      setIsLoadingItem(false);

      return result;

    },

    [org, playlist, offline, online],

  );



  useEffect(() => {

    if (!playlist || !org) {

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

    org,

    itemIndex,

    loadItemAtIndex,

    loadSectionLeads,

    online,

    navState.sequential,

    navState.direction,

  ]);



  useEffect(() => {

    if (!playlist || !org) {

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

      itemCacheRef.current.prefetch(index, () => loadPlaylistItemData(offline, org.id, item));

    }

  }, [playlist, org, itemIndex, offline]);



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

    if (!playlist || !org) {

      return;

    }

    const previousIndex = findPreviousAvailableIndex(playlist, itemIndex);

    if (previousIndex === null) {

      return;

    }



    const cached = await itemCacheRef.current.load(previousIndex, () =>

      loadPlaylistItemData(offline, org.id, playlist.items[previousIndex]),

    );

    const lastPage = cached?.numPages ?? 1;



    goToItem(previousIndex, {

      page: lastPage,

      direction: 'prev',

      sequential: true,

    });

  }, [playlist, org, itemIndex, goToItem, offline]);



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

    if (!org || !currentItem?.pieceId || !online) {

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

      organizationId: org.id,

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

  }, [org, currentItem?.pieceId, online, isAdmin, userId, repertoire, ensemble]);



  const handleSelectAudio = useCallback(

    async (selected: PieceFileWithLinks) => {

      if (!org || !currentItem?.pieceId) {

        return;

      }



      setActiveAudio(selected);

      setAudioUrl(null);



      const result = await repertoire.getPieceFileDownloadUrl(

        org.id,

        currentItem.pieceId,

        selected.id,

      );

      if (!result.ok) {

        setActiveAudio(null);

        return;

      }



      setAudioUrl(result.value);

    },

    [org, currentItem?.pieceId, repertoire],

  );



  const handleCloseAudio = useCallback(() => {

    setActiveAudio(null);

    setAudioUrl(null);

  }, []);



  const handleAnnotationCreate = useCallback(

    async (input: Omit<CreatePdfAnnotationInput, 'pieceFileId'>) => {

      if (!org || !userId || !currentItem?.pieceId) {

        return null;

      }

      if (!online && input.layer === 'section') {

        return null;

      }

      const result = await offline.createPieceFileAnnotation(

        org.id,

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

    [org, userId, currentItem, offline, online],

  );



  const handleAnnotationDelete = useCallback(

    async (annotationId: string) => {

      if (!org || !currentItem) {

        return;

      }



      const result = await offline.deletePieceFileAnnotation(

        org.id,

        currentItem.pieceFileId,

        annotationId,

      );

      if (!result.ok) {

        return;

      }



      setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));

    },

    [org, currentItem, offline],

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

      {org && currentItem.pieceId && (
        <OfflineFileStatusBadge
          organizationId={org.id}
          pieceId={currentItem.pieceId}
          fileId={currentItem.pieceFileId}
        />
      )}

      <PdfViewer

        key={currentItem.pieceFileId}

        url={downloadUrl ?? ''}

        userId={userId}

        annotations={annotations}

        sectionLeadOptions={sectionLeadOptions}

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

              title={activeAudio.title}

              url={audioUrl}

              onClose={handleCloseAudio}

            />

          ) : null

        }

        onAnnotationCreate={handleAnnotationCreate}

        onAnnotationDelete={handleAnnotationDelete}

      />



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

