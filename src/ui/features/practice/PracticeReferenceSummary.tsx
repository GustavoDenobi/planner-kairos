import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PracticeTaskReference } from '@/domain/practice';
import type { PieceDetail } from '@/domain/repertoire';
import { useRepertoire } from '@/ui/app/AppServicesContext';
import { IconScoreSheet } from '@/ui/components/icons';
import { practiceReaderPath } from '@/ui/features/practice/practice-routes';
import { pieceDetailPath } from '@/ui/features/repertoire/piece-file-routes';
import { distinctTitleParts } from '@/ui/features/repertoire/title-parts';

type PracticeReferenceSummaryProps = {
  orgSlug: string;
  organizationId: string;
  taskId: string;
  reference: PracticeTaskReference;
  /** Estilo do rótulo "Partitura" (o card fica com quem usa). */
  labelClassName?: string;
};

/** "Obra › Partitura › Trecho" com o botão para abrir o leitor no ponto certo. */
export function PracticeReferenceSummary({
  orgSlug,
  organizationId,
  taskId,
  reference,
  labelClassName = 'text-xs text-muted',
}: PracticeReferenceSummaryProps) {
  const repertoire = useRepertoire();
  const [piece, setPiece] = useState<PieceDetail | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const pieceId = reference.kind === 'none' ? null : reference.pieceId;

  useEffect(() => {
    if (!pieceId) {
      return;
    }
    let cancelled = false;
    void repertoire.getPiece(organizationId, pieceId).then((result) => {
      if (cancelled) {
        return;
      }
      setPiece(result.ok ? result.value : null);
      setUnavailable(!result.ok);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, pieceId, repertoire]);

  if (reference.kind === 'none') {
    return null;
  }

  const file =
    reference.kind === 'file' ? piece?.files.find((item) => item.id === reference.pieceFileId) : null;
  const fileVisible = reference.kind === 'file' && Boolean(file);

  let locationLabel: string | null = null;
  if (reference.kind === 'file') {
    const location = reference.location;
    if (location.kind === 'toc') {
      locationLabel = `${location.label} (p. ${location.page})`;
    } else if (location.kind === 'point') {
      locationLabel = `a partir da p. ${location.page}`;
    }
  }

  // "Sinfonia › Sinfonia — Grade": o título do arquivo costuma repetir o da obra.
  const parts = distinctTitleParts([
    piece?.title ?? (unavailable ? 'Obra' : 'Carregando…'),
    file?.title,
    locationLabel,
  ]).join(' › ');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className={labelClassName}>Partitura</h2>
        <p className="mt-1 text-sm font-medium text-text">{parts}</p>
        {unavailable || (reference.kind === 'file' && piece && !file) ? (
          <p className="mt-0.5 text-xs text-muted">Esta partitura não está disponível para você.</p>
        ) : null}
      </div>
      {reference.kind === 'file' && fileVisible ? (
        <Link
          to={practiceReaderPath(orgSlug, taskId, reference)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
        >
          <IconScoreSheet className="h-4 w-4" />
          Abrir trecho
        </Link>
      ) : reference.kind === 'piece' && piece ? (
        <Link
          to={pieceDetailPath(orgSlug, reference.pieceId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-2 text-sm font-medium text-text hover:border-primary/40"
        >
          Ver obra
        </Link>
      ) : null}
    </div>
  );
}
