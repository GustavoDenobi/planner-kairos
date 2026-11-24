import { useMemo } from 'react';
import {
  calendarMonthsSince,
  countPerformancesByCategory,
  listForgottenPieces,
  rankMostPerformedPieces,
  summarizeRepertoireReport,
  type PieceCategory,
  type RepertoireReport,
  type RepertoireReportMonth,
} from '@/domain/repertoire';
import {
  categoryBackgroundColor,
  parseCategoryHue,
} from '@/ui/features/repertoire/category-color';
import {
  formatMonthsAgo,
  formatPercent,
  formatPerformanceCount,
  formatReportMonth,
} from '@/ui/features/repertoire/repertoire-report-labels';
import {
  ForgottenThresholdSelect,
  PieceStatList,
  ReportCard,
  ReportLinkButton,
  StatTile,
} from '@/ui/features/repertoire/repertoire-report-ui';

const TOP_LIST_SIZE = 5;

type RepertoireReportOverviewTabProps = {
  report: RepertoireReport;
  orgSlug: string;
  categories: PieceCategory[];
  categoriesById: Map<string, PieceCategory>;
  onOpenPerformances: () => void;
  forgottenThreshold: number;
  onForgottenThresholdChange: (months: number) => void;
};

export function RepertoireReportOverviewTab({
  report,
  orgSlug,
  categories,
  categoriesById,
  onOpenPerformances,
  forgottenThreshold,
  onForgottenThresholdChange,
}: RepertoireReportOverviewTabProps) {
  const summary = useMemo(() => summarizeRepertoireReport(report), [report]);
  const mostPerformed = useMemo(
    () => rankMostPerformedPieces(report.pieces).slice(0, TOP_LIST_SIZE),
    [report],
  );
  const forgotten = useMemo(
    () => listForgottenPieces(report.pieces, forgottenThreshold).slice(0, TOP_LIST_SIZE),
    [report, forgottenThreshold],
  );
  const categoryRows = useMemo(() => {
    const counts = countPerformancesByCategory(report.pieces);
    return categories
      .map((category) => ({ category, performances: counts.get(category.id) ?? 0 }))
      .filter((row) => row.performances > 0)
      .sort((a, b) => b.performances - a.performances);
  }, [report, categories]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Obras no acervo" value={summary.pieceCount} />
        <StatTile
          label="Tocadas no período"
          value={summary.performedPieceCount}
          hint={`${formatPercent(summary.performedShare)} do acervo`}
        />
        <StatTile
          label="Execuções"
          value={summary.performances}
          hint={summary.events === 1 ? 'em 1 evento' : `em ${summary.events} eventos`}
        />
        <StatTile
          label="Nunca tocadas"
          value={summary.neverPerformedCount}
          highlight={summary.neverPerformedCount > 0}
        />
      </div>

      {summary.performances === 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          Nenhuma execução registrada com estes filtros. As execuções vêm da programação dos
          eventos: marque cada obra como tocada no evento.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="Execuções por mês">
          <MonthlyBars months={report.months} />
        </ReportCard>

        <ReportCard title="Execuções por categoria">
          {categoryRows.length === 0 ? (
            <p className="rounded-lg bg-bg px-3 py-4 text-center text-sm text-muted">
              Sem execuções no período.
            </p>
          ) : (
            <ul className="space-y-2">
              {categoryRows.map(({ category, performances }) => {
                const max = categoryRows[0].performances;
                return (
                  <li key={category.id} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
                    <span className="truncate text-sm text-text">{category.name}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-bg">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(4, (performances / max) * 100)}%`,
                          backgroundColor: categoryBackgroundColor(
                            parseCategoryHue(category.color, category.slug),
                          ),
                        }}
                      />
                    </span>
                    <span className="text-sm tabular-nums text-muted">{performances}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </ReportCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard
          title="Mais tocadas"
          action={<ReportLinkButton onClick={onOpenPerformances}>Ver ranking</ReportLinkButton>}
        >
          <PieceStatList
            orgSlug={orgSlug}
            pieces={mostPerformed}
            categoriesById={categoriesById}
            numbered
            showCategory={false}
            renderTrailing={(piece) => formatPerformanceCount(piece.performances)}
            emptyText="Nenhuma obra tocada no período."
          />
        </ReportCard>

        <ReportCard
          title="Esquecidas"
          description={`Tocadas antes, mas não nos últimos ${forgottenThreshold} meses`}
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ForgottenThresholdSelect
                value={forgottenThreshold}
                onChange={onForgottenThresholdChange}
              />
              <ReportLinkButton onClick={onOpenPerformances}>Ver todas</ReportLinkButton>
            </div>
          }
        >
          <PieceStatList
            orgSlug={orgSlug}
            pieces={forgotten}
            categoriesById={categoriesById}
            showCategory={false}
            renderTrailing={(piece) =>
              formatMonthsAgo(calendarMonthsSince(piece.lastPerformedAt as string))
            }
            emptyText="Nenhuma obra esquecida."
          />
        </ReportCard>
      </div>
    </div>
  );
}

function MonthlyBars({ months }: { months: RepertoireReportMonth[] }) {
  const max = Math.max(1, ...months.map((month) => month.performances));
  const first = months[0]?.month;
  const last = months[months.length - 1]?.month;

  return (
    <div>
      <div className="flex h-40 items-end gap-1" role="img" aria-label="Execuções por mês">
        {months.map((month) => (
          <div
            key={month.month}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`${formatReportMonth(month.month, true)}: ${formatPerformanceCount(month.performances)}`}
          >
            {month.performances > 0 && (
              <span className="text-[11px] tabular-nums text-muted">{month.performances}</span>
            )}
            <span
              className={`block w-full max-w-8 rounded-t ${month.performances > 0 ? 'bg-primary' : 'bg-border'}`}
              style={{ height: `${Math.max(2, (month.performances / max) * 85)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-border pt-1">
        {months.map((month) => (
          <span
            key={month.month}
            className="min-w-0 flex-1 overflow-hidden text-center text-[11px] text-muted"
          >
            {formatReportMonth(month.month)}
          </span>
        ))}
      </div>
      {first && last && (
        <p className="mt-2 text-xs text-muted">
          {first === last
            ? formatReportMonth(first, true)
            : `${formatReportMonth(first, true)} a ${formatReportMonth(last, true)}`}
        </p>
      )}
    </div>
  );
}
