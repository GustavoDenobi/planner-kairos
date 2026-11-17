import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useRepertoire } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { pieceDetailPath } from '@/ui/features/repertoire/piece-file-routes';
import { repertoireErrorMessage } from '@/ui/features/repertoire/repertoire-labels';
import { isOrgAdminAccess } from '@/ui/layouts/nav-config';
import { downloadFromUrl } from '@/ui/utils/download-url';

export function PieceDownloadPage() {
  const { orgSlug, pieceId } = useParams();
  const { userId } = useAuth();
  const { resolveOrgBySlug, isPlatformAdmin } = useOrg();
  const repertoire = useRepertoire();
  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;
  const isAdmin = isOrgAdminAccess(org ?? undefined, isPlatformAdmin);

  const [pieceTitle, setPieceTitle] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const startedRef = useRef(false);

  const isBusy = !error && !isDone && totalFiles > 0;
  useLoadingBar('piece-download', isBusy || (!error && !isDone && totalFiles === 0 && isAdmin));

  useEffect(() => {
    if (!org || !pieceId || !userId || !isAdmin || startedRef.current) {
      return;
    }
    startedRef.current = true;

    let cancelled = false;

    async function run() {
      const result = await repertoire.preparePieceAdminDownload(org!.id, pieceId!, userId!);
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(repertoireErrorMessage(result.error));
        return;
      }

      const { pieceTitle: title, files } = result.value;
      setPieceTitle(title);
      setTotalFiles(files.length);

      if (files.length === 0) {
        setIsDone(true);
        return;
      }

      for (let index = 0; index < files.length; index += 1) {
        if (cancelled) {
          return;
        }
        setCurrentIndex(index + 1);
        const file = files[index]!;
        try {
          await downloadFromUrl(file.url, file.filename);
        } catch {
          setError(`Não foi possível baixar “${file.filename}”.`);
          return;
        }
      }

      if (!cancelled) {
        setIsDone(true);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [org, pieceId, userId, isAdmin, repertoire]);

  if (!orgSlug || !pieceId) {
    return <Navigate to="/orgs" replace />;
  }

  if (org && !isAdmin) {
    return <Navigate to={pieceDetailPath(orgSlug, pieceId)} replace />;
  }

  if (isDone) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium">
          {totalFiles === 0
            ? `“${pieceTitle ?? 'Obra'}” não tem arquivos para baixar.`
            : `Download concluído (${totalFiles} arquivo${totalFiles === 1 ? '' : 's'}).`}
        </p>
        <a href={pieceDetailPath(orgSlug, pieceId)} className="text-sm text-primary underline">
          Voltar à obra
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <a href={pieceDetailPath(orgSlug, pieceId)} className="text-sm text-primary underline">
          Voltar à obra
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-sm font-medium">
        {pieceTitle ? `Baixando arquivos de “${pieceTitle}”…` : 'Preparando download…'}
      </p>
      {totalFiles > 0 ? (
        <p className="text-xs text-muted">
          Arquivo {currentIndex} de {totalFiles}
        </p>
      ) : null}
    </div>
  );
}
