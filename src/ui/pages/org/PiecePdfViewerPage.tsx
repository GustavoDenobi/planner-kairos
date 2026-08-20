import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type * as pdfjs from 'pdfjs-dist';
import type { CreatePdfAnnotationInput, PdfAnnotation, PieceFileWithLinks } from '@/domain/repertoire';
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

export function PiecePdfViewerPage() {
  const { orgSlug, pieceId, fileId } = useParams();
  const repertoire = useRepertoire();
  const offline = useOffline();
  const ensemble = useEnsemble();
  const { userId } = useAuth();
  const { resolveOrgBySlug } = useOrg();
  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;
  const online = useOnlineStatus();

  const [file, setFile] = useState<PieceFileWithLinks | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [preloadedPdf, setPreloadedPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [sectionLeadOptions, setSectionLeadOptions] = useState<SectionLeadOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useLoadingBar('piece-pdf-viewer', isLoading);
  const [error, setError] = useState<string | null>(null);
  const [isCachedLocally, setIsCachedLocally] = useState(false);

  const detailPath =
    orgSlug && pieceId ? pieceDetailPath(orgSlug, pieceId) : `/${orgSlug ?? ''}/repertorio`;

  useEffect(() => {
    if (!pieceId || !fileId) {
      return;
    }

    if (!org) {
      setIsLoading(false);
      setError('Organização não encontrada. Volte e selecione outra organização.');
      return;
    }

    const organizationId = org.id;
    const currentPieceId = pieceId;
    const currentFileId = fileId;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setFile(null);
      setDownloadUrl(null);
      setPreloadedPdf(null);
      setAnnotations([]);
      setSectionLeadOptions([]);

      const statusResult = await offline.getOfflineStatus(
        organizationId,
        currentPieceId,
        currentFileId,
      );
      if (!cancelled && statusResult.ok) {
        setIsCachedLocally(statusResult.value.fileStatus !== 'not_cached');
      }

      let pieceFile: PieceFileWithLinks | null = null;
      if (online) {
        const pieceResult = await repertoire.getPiece(organizationId, currentPieceId);
        if (!cancelled && pieceResult.ok) {
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
        } else if (!cancelled) {
          setError('Obra não encontrada. Ela pode ter sido removida — volte ao repertório.');
          setIsLoading(false);
          return;
        }
      }

      const pdfLoad = await resolvePdfDocument(
        offline,
        organizationId,
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

      const annotationsResult = await offline.listAnnotationsForReading(
        organizationId,
        currentFileId,
      );

      if (userId && online) {
        const musicianResult = await ensemble.getMyMusician(organizationId, userId);
        if (!cancelled && musicianResult.ok) {
          const assignmentsResult = await ensemble.listAssignmentsForMusician(
            organizationId,
            musicianResult.value.id,
          );
          if (!cancelled && assignmentsResult.ok) {
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
        }
      }

      if (cancelled) {
        return;
      }

      if (!pieceFile) {
        pieceFile = {
          id: currentFileId,
          organizationId,
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
      if (annotationsResult.ok) {
        setAnnotations(annotationsResult.value);
      }
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [org, pieceId, fileId, repertoire, offline, ensemble, userId, online]);

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

  const viewerKey = useMemo(
    () => `${fileId}-${downloadUrl ?? 'local'}-${preloadedPdf?.numPages ?? 0}`,
    [fileId, downloadUrl, preloadedPdf],
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
        org ? (
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
        key={viewerKey}
        url={downloadUrl ?? ''}
        userId={userId}
        annotations={annotations}
        sectionLeadOptions={sectionLeadOptions}
        preloadedPdf={preloadedPdf}
        onAnnotationCreate={handleAnnotationCreate}
        onAnnotationDelete={handleAnnotationDelete}
      />
    </ReaderLayout>
  );
}
