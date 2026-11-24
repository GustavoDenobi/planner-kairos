import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  FORGOTTEN_PIECE_THRESHOLDS_MONTHS,
  type PieceCategory,
  type RepertoireReportPieceRow,
} from '@/domain/repertoire';
import { CategoryBadge } from '@/ui/components/CategoryBadge';
import { pieceDetailPath } from '@/ui/features/repertoire/piece-file-routes';

type ReportCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function ReportCard({ title, description, action, children }: ReportCardProps) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

type StatTileProps = {
  label: string;
  value: number | string;
  hint?: string;
  highlight?: boolean;
};

export function StatTile({ label, value, hint, highlight = false }: StatTileProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${highlight ? 'text-accent' : 'text-text'}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ReportLinkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-bg px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:brightness-95"
    >
      {children}
    </button>
  );
}

export function ForgottenThresholdSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (months: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span>Sem tocar há</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-lg border border-border bg-bg px-2 py-1 text-sm text-text"
      >
        {FORGOTTEN_PIECE_THRESHOLDS_MONTHS.map((months) => (
          <option key={months} value={months}>
            {months} meses
          </option>
        ))}
      </select>
    </label>
  );
}

type PieceStatListProps = {
  orgSlug: string;
  pieces: RepertoireReportPieceRow[];
  categoriesById: Map<string, PieceCategory>;
  /** Texto à direita de cada obra (ex.: "5 vezes", "há 8 meses"). */
  renderTrailing: (piece: RepertoireReportPieceRow) => ReactNode;
  emptyText: string;
  numbered?: boolean;
  /** Mostra os itens em páginas desse tamanho, com um botão para carregar a próxima. */
  pageSize?: number;
  showCategory?: boolean;
};

export function PieceStatList({
  orgSlug,
  pieces,
  categoriesById,
  renderTrailing,
  emptyText,
  numbered = false,
  pageSize,
  showCategory = true,
}: PieceStatListProps) {
  const [visibleCount, setVisibleCount] = useState(pageSize ?? pieces.length);
  const [shownPieces, setShownPieces] = useState(pieces);

  // Nova lista (filtros, limite de meses) volta para a primeira página.
  if (shownPieces !== pieces) {
    setShownPieces(pieces);
    setVisibleCount(pageSize ?? pieces.length);
  }

  if (pieces.length === 0) {
    return <p className="rounded-lg bg-bg px-3 py-4 text-center text-sm text-muted">{emptyText}</p>;
  }

  const visible = pageSize === undefined ? pieces : pieces.slice(0, visibleCount);
  const hiddenCount = pieces.length - visible.length;
  const nextCount = Math.min(pageSize ?? hiddenCount, hiddenCount);

  return (
    <div>
      <ol className="divide-y divide-border">
        {visible.map((piece, index) => {
          const category = categoriesById.get(piece.categoryId);
          return (
            <li key={piece.pieceId} className="flex items-center gap-3 py-2">
              {numbered && (
                <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted">
                  {index + 1}
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  to={pieceDetailPath(orgSlug, piece.pieceId)}
                  className="truncate text-sm font-medium text-text hover:text-primary"
                >
                  {piece.title}
                </Link>
                {showCategory && category && (
                  <CategoryBadge label={category.name} color={category.color} slug={category.slug} />
                )}
              </div>
              <span className="shrink-0 text-sm tabular-nums text-muted">
                {renderTrailing(piece)}
              </span>
            </li>
          );
        })}
      </ol>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + (pageSize ?? hiddenCount))}
          className="mt-2 w-full rounded-lg bg-bg py-2 text-sm font-medium text-primary transition-colors hover:brightness-95"
        >
          Mostrar mais {nextCount}
          <span className="font-normal text-muted">
            {' · '}
            {hiddenCount === 1 ? '1 restante' : `${hiddenCount} restantes`}
          </span>
        </button>
      )}
    </div>
  );
}
