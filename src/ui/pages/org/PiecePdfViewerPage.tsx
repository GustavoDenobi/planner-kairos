import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type * as pdfjs from 'pdfjs-dist';
import type { CreatePdfAnnotationInput, CreatePdfNavigationShortcutInput, PdfAnnotation, PdfNavigationShortcut, PieceFileWithLinks, UpdatePdfNavigationShortcutInput } from '@/domain/repertoire';
import { useRepertoire, useOffline, useEnsemble } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { BackLink } from '@/ui/components/BackButton';
import { PdfViewer, type SectionLeadOption } from '@/ui/features/repertoire/PdfViewer';
import { pieceDetailPath } from '@/ui/features/repertoire/piece-file-routes';
import { repertoireErrorMessage } from '@/ui/features/repertoire/repertoire-labels';
import { resolvePdfDocument, revokePdfObjectUrl } from '@/ui/features/repertoire/pdf-load';
import { OfflineBanner } from '@/ui/features/pwa/OfflineBanner';
import {
  OfflineDownloadButton,
  OfflineFileStatusBadge,
} from '@/ui/features/pwa/OfflineDownloadButton';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';
import { ReaderLayout } from '@/ui/layouts/ReaderLayout';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { PieceAudioPickerModal } from '@/ui/features/repertoire/PieceAudioPickerModal';
import { PdfViewerInlineAudioBar } from '@/ui/features/repertoire/PdfViewerInlineAudioBar';
import { loadPieceViewerAudioContext } from '@/ui/features/repertoire/piece-viewer-audio';
import { buildResolvedPieceFileAccess } from '@/ui/features/repertoire/resolve-piece-access-for-viewer';
import type { PieceDetail } from '@/domain/repertoire';
import { resolveCanManageNavigationShortcuts } from '@/ui/features/repertoire/resolve-can-manage-navigation-shortcuts';
import type { AssignmentWithDetails, GroupFileAccessSettings } from '@/domain/ensemble';

export function PiecePdfViewerPage() {
  const { orgSlug, pieceId, fileId } = useParams();
  const repertoire = useRepertoire();
  const offline = useOffline();
  const ensemble = useEnsemble();
  const { userId } = useAuth();
  const { resolveOrgBySlug } = useOrg();
  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;
  const organizationId = org?.id;
  const online = useOnlineStatus();
  const loadedKeyRef = useRef<string | null>(null);

  const [file, setFile] = useState<PieceFileWithLinks | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [preloadedPdf, setPreloadedPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [navigationShortcuts, setNavigationShortcuts] = useState<PdfNavigationShortcut[]>([]);
  const [canManageNavigationShortcuts, setCanManageNavigationShortcuts] = useState(false);
  const [sectionLeadOptions, setSectionLeadOptions] = useState<SectionLeadOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('piece-pdf-viewer', isLoading);
  const [error, setError] = useState<string | null>(null);
  const [isCachedLocally, setIsCachedLocally] = useState(false);
  const [allowFileDownload, setAllowFileDownload] = useState(true);
  const [accessibleAudios, setAccessibleAudios] = useState<PieceFileWithLinks[]>([]);
  const [audioParts, setAudioParts] = useState<PartWithDivisions[]>([]);
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [activeAudio, setActiveAudio] = useState<PieceFileWithLinks | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';

  const detailPath =
    orgSlug && pieceId ? pieceDetailPath(orgSlug, pieceId) : `/${orgSlug ?? ''}/repertorio`;

  async function resolveDownloadAccess(
    pieceDetail: PieceDetail,
    organizationId: string,
    cancelled: boolean,
  ) {
    if (isAdmin) {
      if (!cancelled) {
        setAllowFileDownload(true);
      }
      return;
    }

    if (!userId) {
      if (!cancelled) {
        setAllowFileDownload(false);
      }
      return;
    }

    const musicianResult = await ensemble.getMyMusician(organizationId, userId);
    if (cancelled) {
      return;
    }

    const assignmentsResult = musicianResult.ok
      ? await ensemble.listAssignmentsForMusician(organizationId, musicianResult.value.id)
      : null;
    const assignments: AssignmentWithDetails[] = assignmentsResult?.ok ? assignmentsResult.value : [];

    const linkedGroupIds = pieceDetail.groups.map((group) => group.id);
    const groupSettingsById = new Map<string, GroupFileAccessSettings>();
    await Promise.all(
      linkedGroupIds.map(async (groupId) => {
        const result = await ensemble.getGroup(organizationId, groupId);
        if (result.ok) {
          groupSettingsById.set(groupId, {
            fileAccessScope: result.value.fileAccessScope,
            allowFileDownload: result.value.allowFileDownload,
            audioAccessScope: result.value.audioAccessScope,
            audioAllowDownload: result.value.audioAllowDownload,
            allowPieceAccessOverride: result.value.allowPieceAccessOverride,
          });
        }
      }),
    );

    if (cancelled) {
      return;
    }

    const resolved = buildResolvedPieceFileAccess({
      isAdmin: false,
      piece: pieceDetail,
      userMusicianId: musicianResult.ok ? musicianResult.value.id : null,
      assignments,
      groupSettingsById,
    });
    setAllowFileDownload(resolved?.allowDownload ?? false);
  }

  useEffect(() => {
    if (!pieceId || !fileId) {
      return;
    }

    if (!organizationId) {
      setIsLoading(false);
      setError('Organização não encontrada. Volte e selecione outra organização.');
      return;
    }

    const resolvedOrganizationId = organizationId;
    const currentPieceId = pieceId;
    const currentFileId = fileId;
    const loadKey = `${resolvedOrganizationId}:${currentPieceId}:${currentFileId}`;

    if (loadedKeyRef.current === loadKey) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setFile(null);
      setDownloadUrl(null);
      setPreloadedPdf(null);
      setAnnotations([]);
      setNavigationShortcuts([]);
      setCanManageNavigationShortcuts(false);

      const pdfLoad = await resolvePdfDocument(
        offline,
        resolvedOrganizationId,
        currentPieceId,
        currentFileId,
      );

      if (cancelled) {
        return;
      }

      if (pdfLoad.error === 'offline_not_cached') {
        setError('Partitura não disponível offline. Toque em "Manter no dispositivo" com conexão ativa.');
        setIsLoading(false);
        return;
      }

      if (pdfLoad.error || !pdfLoad.pdfDocument) {
        setError(
          pdfLoad.error === 'not_found'
            ? 'Arquivo não encontrado nesta obra. Volte à obra e escolha outra partitura.'
            : repertoireErrorMessage(pdfLoad.error ?? 'load_failed'),
        );
        setIsLoading(false);
        return;
      }

      let pieceFile: PieceFileWithLinks | null = null;
      let pieceDetailForAccess: PieceDetail | null = null;
      if (online && pdfLoad.resolved?.source !== 'local') {
        const pieceResult = await repertoire.getPiece(resolvedOrganizationId, currentPieceId);
        if (!cancelled && pieceResult.ok) {
          pieceDetailForAccess = pieceResult.value;
          const found = pieceResult.value.files.find((item) => item.id === currentFileId);
          if (!found) {
            setError('Arquivo não encontrado nesta obra. Volte à obra e escolha outra partitura.');
            setIsLoading(false);
            return;
          }
          if (found.kind !== 'score') {
            setError('Este arquivo não é uma partitura PDF. Abra um arquivo do tipo partitura.');
            setIsLoading(false);
            return;
          }
          pieceFile = found;
          await resolveDownloadAccess(pieceResult.value, resolvedOrganizationId, cancelled);
        }
      }

      const annotationsResult = await offline.listAnnotationsForReading(
        resolvedOrganizationId,
        currentFileId,
      );
      const shortcutsResult = await offline.listNavigationShortcutsForReading(
        resolvedOrganizationId,
        currentFileId,
      );

      if (cancelled) {
        return;
      }

      if (!pieceFile) {
        pieceFile = {
          id: currentFileId,
          organizationId: resolvedOrganizationId,
          pieceId: currentPieceId,
          kind: 'score',
          storageKey: '',
          mimeType: 'application/pdf',
          title: 'Partitura',
          originalName: 'partitura.pdf',
          byteSize: null,
          contentHash: null,
          partLinks: [],
        };
      }

      setFile(pieceFile);
      setDownloadUrl(pdfLoad.downloadUrl);
      setPreloadedPdf(pdfLoad.pdfDocument);
      setIsCachedLocally(pdfLoad.resolved?.source === 'local');
      if (annotationsResult.ok) {
        setAnnotations(annotationsResult.value);
      }
      if (shortcutsResult.ok) {
        setNavigationShortcuts(shortcutsResult.value);
      }

      if (userId) {
        if (isAdmin) {
          setCanManageNavigationShortcuts(true);
        } else if (pieceDetailForAccess) {
          const musicianResult = await ensemble.getMyMusician(resolvedOrganizationId, userId);
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
            const groupId = assignment.groupId;
            const cachedPartIdsMap = online
              ? null
              : await offline.getCachedSectionPartIdsByGroup(
                  resolvedOrganizationId,
                  userId,
                  groupId,
                );
            if (cachedPartIdsMap) {
              for (const partId of cachedPartIdsMap.get(assignment.sectionId) ?? []) {
                sectionPartIds.add(partId);
              }
            } else if (online) {
              const partIdsResult = await ensemble.listSectionPartIdsByGroup(
                resolvedOrganizationId,
                groupId,
              );
              if (partIdsResult.ok) {
                for (const partId of partIdsResult.value.get(assignment.sectionId) ?? []) {
                  sectionPartIds.add(partId);
                }
              }
            }
          }

          setCanManageNavigationShortcuts(
            resolveCanManageNavigationShortcuts({
              isAdmin: false,
              assignments,
              pieceGroupIds: pieceDetailForAccess.groups.map((group) => group.id),
              filePartLinks: pieceFile.partLinks,
              sectionPartIdsBySectionLead: [...sectionPartIds],
            }),
          );
        }
      }

      loadedKeyRef.current = loadKey;
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [organizationId, pieceId, fileId, repertoire, offline, online, isAdmin, ensemble, userId]);

  useEffect(() => {
    if (!organizationId || !userId || !online) {
      setSectionLeadOptions([]);
      return;
    }

    const resolvedOrganizationId = organizationId;
    const resolvedUserId = userId;
    let cancelled = false;

    async function loadSectionLeads() {
      const musicianResult = await ensemble.getMyMusician(resolvedOrganizationId, resolvedUserId);
      if (cancelled || !musicianResult.ok) {
        return;
      }

      const assignmentsResult = await ensemble.listAssignmentsForMusician(
        resolvedOrganizationId,
        musicianResult.value.id,
      );
      if (cancelled || !assignmentsResult.ok) {
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
    }

    void loadSectionLeads();

    return () => {
      cancelled = true;
    };
  }, [organizationId, userId, online, ensemble]);

  useEffect(() => {
    if (!organizationId || !pieceId || !online) {
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
      pieceId,
      isAdmin,
      userId,
      online,
    }).then((context) => {
      if (cancelled) {
        return;
      }
      setAccessibleAudios(context?.audios ?? []);
      setAudioParts(context?.parts ?? []);
    });

    return () => {
      cancelled = true;
    };
  }, [organizationId, pieceId, online, isAdmin, userId, repertoire, ensemble]);

  const handleSelectAudio = useCallback(
    async (selected: PieceFileWithLinks) => {
      if (!org || !pieceId) {
        return;
      }

      setActiveAudio(selected);
      setAudioUrl(null);

      const result = await repertoire.getPieceFileDownloadUrl(org.id, pieceId, selected.id);
      if (!result.ok) {
        setActiveAudio(null);
        return;
      }

      setAudioUrl(result.value);
    },
    [org, pieceId, repertoire],
  );

  const handleCloseAudio = useCallback(() => {
    setActiveAudio(null);
    setAudioUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      revokePdfObjectUrl(downloadUrl);
    };
  }, [downloadUrl]);

  const handleAnnotationCreate = useCallback(
    async (input: Omit<CreatePdfAnnotationInput, 'pieceFileId'>) => {
      if (!org || !pieceId || !fileId || !userId || !file) {
        return null;
      }

      if (!online && input.layer === 'section') {
        return null;
      }

      const result = await offline.createPieceFileAnnotation(org.id, pieceId, userId, {
        ...input,
        pieceFileId: file.id,
      });

      if (!result.ok) {
        return null;
      }

      setAnnotations((current) => [...current, result.value]);
      return result.value;
    },
    [org, pieceId, fileId, userId, file, offline, online],
  );

  const handleAnnotationDelete = useCallback(
    async (annotationId: string) => {
      if (!org || !fileId || !file) {
        return;
      }

      const result = await offline.deletePieceFileAnnotation(org.id, file.id, annotationId);
      if (!result.ok) {
        return;
      }

      setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));
    },
    [org, fileId, file, offline],
  );

  const handleNavigationShortcutCreate = useCallback(
    async (input: Omit<CreatePdfNavigationShortcutInput, 'pieceFileId'>) => {
      if (!org || !pieceId || !fileId || !userId || !file) {
        return null;
      }

      const result = await offline.createPieceFileNavigationShortcut(
        org.id,
        pieceId,
        userId,
        { ...input, pieceFileId: file.id },
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
    [org, pieceId, fileId, userId, file, offline],
  );

  const handleNavigationShortcutUpdate = useCallback(
    async (shortcutId: string, input: UpdatePdfNavigationShortcutInput) => {
      if (!org || !fileId || !file) {
        return null;
      }

      const result = await offline.updatePieceFileNavigationShortcut(
        org.id,
        file.id,
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
    [org, fileId, file, offline],
  );

  const handleNavigationShortcutDelete = useCallback(
    async (shortcutId: string) => {
      if (!org || !fileId || !file) {
        return;
      }

      const result = await offline.deletePieceFileNavigationShortcut(org.id, file.id, shortcutId);
      if (!result.ok) {
        return;
      }

      setNavigationShortcuts((current) => current.filter((item) => item.id !== shortcutId));
    },
    [org, fileId, file, offline],
  );

  const handleNavigationShortcutReorder = useCallback(
    async (orderedIds: string[]) => {
      if (!org || !fileId || !file) {
        return;
      }

      const result = await offline.reorderPieceFileNavigationShortcuts(
        org.id,
        file.id,
        orderedIds,
      );

      if (result.ok) {
        setNavigationShortcuts(result.value);
      }
    },
    [org, fileId, file, offline],
  );

  if (!orgSlug || !pieceId || !fileId) {
    return null;
  }

  if (isLoading) {
    return (
      <ReaderLayout title="Carregando…" backTo={detailPath}>
        <p className="p-4 text-sm text-muted">Carregando partitura…</p>
      </ReaderLayout>
    );
  }

  if (error || !file || !preloadedPdf) {
    return (
      <ReaderLayout title="Erro" backTo={detailPath}>
        <div className="space-y-4 p-4">
          <p className="text-sm text-red-600">{error ?? 'Não foi possível abrir o arquivo.'}</p>
          <BackLink
            fallbackTo={detailPath}
            className="text-sm font-medium text-primary hover:underline"
          >
            Voltar para a obra
          </BackLink>
        </div>
      </ReaderLayout>
    );
  }

  return (
    <ReaderLayout
      title={file.title}
      backTo={detailPath}
      downloadUrl={downloadUrl}
      downloadName={file.originalName}
      offlineBanner={<OfflineBanner isCached={isCachedLocally} />}
      headerActions={
        org && allowFileDownload ? (
          <OfflineDownloadButton
            organizationId={org.id}
            pieceId={pieceId}
            fileId={fileId}
          />
        ) : null
      }
    >
      {org && (
        <OfflineFileStatusBadge organizationId={org.id} pieceId={pieceId} fileId={fileId} />
      )}
      <PdfViewer
        key={fileId}
        url={downloadUrl ?? ''}
        userId={userId}
        annotations={annotations}
        sectionLeadOptions={sectionLeadOptions}
        preloadedPdf={preloadedPdf}
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
