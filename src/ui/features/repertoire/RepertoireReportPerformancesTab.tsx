import { useMemo } from 'react';
import {
  calendarMonthsSince,
  listForgottenPieces,
  listNeverPerformedPieces,
  rankMostPerformedPieces,
  summarizeProgramStatus,
  type PieceCategory,
  type RepertoireReport,
} from '@/domain/repertoire';
import { formatEventDateNumeric } from '@/ui/features/agenda/agenda-date';
import {
  formatMonthsAgo,
  formatPerformanceCount,
} from '@/ui/features/repertoire/repertoire-report-labels';
import {
  ForgottenThresholdSelect,
  PieceStatList,
  ReportCard,
  StatTile,
} from '@/ui/features/repertoire/repertoire-report-ui';

const LIST_PAGE_SIZE = 15;

type RepertoireReportPerformancesTabProps = {
  report: RepertoireReport;
  orgSlug: string;
  categoriesById: Map<string, PieceCategory>;
  forgottenThreshold: number;
  onForgottenThresholdChange: (months: number) => void;
};

export function RepertoireReportPerformancesTab({
  report,
  orgSlug,
  categoriesById,
  forgottenThreshold,
  onForgottenThresholdChange,
}: RepertoireReportPerformancesTabProps) {

  const statusTotals = useMemo(() => summarizeProgramStatus(report.pieces), [report]);
  const ranking = useMemo(() => rankMostPerformedPieces(report.pieces), [report]);
  const forgotten = useMemo(
    () => listForgottenPieces(report.pieces, forgottenThreshold),
    [report, forgottenThreshold],
  );
  const neverPerformed = useMemo(() => listNeverPerformedPieces(report.pieces), [report]);

  return (
    <div className="space-y-4">
      <ReportCard title="Programação do período">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Tocadas" value={statusTotals.performed} />
          <StatTile label="Puladas" value={statusTotals.skipped} />
          <StatTile
            label="Sem marcação"
            value={statusTotals.unmarked}
            highlight={statusTotals.unmarked > 0}
          />
        </div>
      </ReportCard>

      <ReportCard title="Ranking de execuções">
        <PieceStatList
          orgSlug={orgSlug}
          pieces={ranking}
          categoriesById={categoriesById}
          numbered
          pageSize={LIST_PAGE_SIZE}
          renderTrailing={(piece) => (
            <>
              <span className="font-medium text-text">
                {formatPerformanceCount(piece.performances)}
              </span>
              {piece.lastPerformedAt && (
                <span className="ml-2 hidden sm:inline">
                  última em {formatEventDateNumeric(piece.lastPerformedAt)}
                </span>
              )}
            </>
          )}
          emptyText="Nenhuma obra tocada no período."
        />
      </ReportCard>

      <ReportCard
        title="Esquecidas"
        action={
          <ForgottenThresholdSelect
            value={forgottenThreshold}
            onChange={onForgottenThresholdChange}
          />
        }
      >
        <PieceStatList
          orgSlug={orgSlug}
          pieces={forgotten}
          categoriesById={categoriesById}
          pageSize={LIST_PAGE_SIZE}
          renderTrailing={(piece) =>
            formatMonthsAgo(calendarMonthsSince(piece.lastPerformedAt as string))
          }
          emptyText="Nenhuma obra esquecida com esse limite."
        />
      </ReportCard>

      <ReportCard title="Nunca tocadas">
        <PieceStatList
          orgSlug={orgSlug}
          pieces={neverPerformed}
          categoriesById={categoriesById}
          pageSize={LIST_PAGE_SIZE}
          renderTrailing={() => null}
          emptyText="Todas as obras já foram tocadas."
        />
      </ReportCard>
    </div>
  );
}
