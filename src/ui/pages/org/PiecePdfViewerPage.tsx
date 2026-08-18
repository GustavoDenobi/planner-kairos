import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CreatePdfAnnotationInput, PdfAnnotation, PieceFileWithLinks } from '@/domain/repertoire';
import { useRepertoire, useEnsemble } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { BackLink } from '@/ui/components/BackButton';
import { PdfViewer, type SectionLeadOption } from '@/ui/features/repertoire/PdfViewer';
import {
  pieceDetailPath,
} from '@/ui/features/repertoire/piece-file-routes';
import { repertoireErrorMessage } from '@/ui/features/repertoire/repertoire-labels';
import { ReaderLayout } from '@/ui/layouts/ReaderLayout';

export function PiecePdfViewerPage() {
  const { orgSlug, pieceId, fileId } = useParams();
  const repertoire = useRepertoire();
  const ensemble = useEnsemble();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((organization) => organization.slug === orgSlug);

  const [file, setFile] = useState<PieceFileWithLinks | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<PdfAnnotation[]>([]);
  const [sectionLeadOptions, setSectionLeadOptions] = useState<SectionLeadOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detailPath =
    orgSlug && pieceId ? pieceDetailPath(orgSlug, pieceId) : `/${orgSlug ?? ''}/repertorio`;

  useEffect(() => {
    if (!pieceId || !fileId) {
      return;
    }

    if (!org) {
      setIsLoading(false);
      setError('Organização não encontrada.');
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
      setAnnotations([]);
      setSectionLeadOptions([]);

      const pieceResult = await repertoire.getPiece(organizationId, currentPieceId);
      if (cancelled) {
        return;
      }

      if (!pieceResult.ok) {
        setError('Obra não encontrada.');
        setIsLoading(false);
        return;
      }

      const pieceFile = pieceResult.value.files.find((item) => item.id === currentFileId);
      if (!pieceFile) {
        setError('Arquivo não encontrado.');
        setIsLoading(false);
        return;
      }

      if (pieceFile.kind !== 'score') {
        setError('Este arquivo não é uma partitura PDF.');
        setIsLoading(false);
        return;
      }

      const [urlResult, annotationsResult] = await Promise.all([
        repertoire.getPieceFileDownloadUrl(organizationId, currentPieceId, currentFileId),
        repertoire.listPieceFileAnnotations(organizationId, currentFileId),
      ]);

      if (cancelled) {
        return;
      }

      if (!urlResult.ok) {
        setError(repertoireErrorMessage(urlResult.error));
        setIsLoading(false);
        return;
      }

      if (userId) {
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

      setFile(pieceFile);
      setDownloadUrl(urlResult.value);
      if (annotationsResult.ok) {
        setAnnotations(annotationsResult.value);
      }
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [org, pieceId, fileId, repertoire, ensemble, userId]);

  const handleAnnotationCreate = useCallback(
    async (input: Omit<CreatePdfAnnotationInput, 'pieceFileId'>) => {
      if (!org || !pieceId || !fileId || !userId || !file) {
        return null;
      }

      const result = await repertoire.createPieceFileAnnotation(org.id, pieceId, userId, {
        ...input,
        pieceFileId: file.id,
      });

      if (!result.ok) {
        return null;
      }

      setAnnotations((current) => [...current, result.value]);
      return result.value;
    },
    [org, pieceId, fileId, userId, file, repertoire],
  );

  const handleAnnotationDelete = useCallback(
    async (annotationId: string) => {
      if (!org || !fileId || !file) {
        return;
      }

      const result = await repertoire.deletePieceFileAnnotation(org.id, file.id, annotationId);
      if (!result.ok) {
        return;
      }

      setAnnotations((current) => current.filter((annotation) => annotation.id !== annotationId));
    },
    [org, fileId, file, repertoire],
  );

  const viewerKey = useMemo(() => `${fileId}-${downloadUrl ?? ''}`, [fileId, downloadUrl]);

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

  if (error || !file || !downloadUrl) {
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
    >
      <PdfViewer
        key={viewerKey}
        url={downloadUrl}
        userId={userId}
        annotations={annotations}
        sectionLeadOptions={sectionLeadOptions}
        onAnnotationCreate={handleAnnotationCreate}
        onAnnotationDelete={handleAnnotationDelete}
      />
    </ReaderLayout>
  );
}
