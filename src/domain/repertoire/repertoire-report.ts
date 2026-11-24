/**
 * Relatórios do repertório. Uma execução é um item de programa marcado como tocado
 * (`performed`) em evento não cancelado; o banco já entrega as contagens filtradas.
 */

export type RepertoireReportPieceRow = {
  pieceId: string;
  title: string;
  categoryId: string;
  /** Execuções no período. */
  performances: number;
  /** Itens marcados como pulados no período. */
  skipped: number;
  /** Itens de eventos já passados, no período, que ficaram sem marcação. */
  unmarked: number;
  /** Última execução em todo o histórico (respeita grupo e tipo de evento). */
  lastPerformedAt: string | null;
};

export type RepertoireReportMonth = {
  /** `YYYY-MM` */
  month: string;
  performances: number;
};

export type RepertoireReport = {
  pieces: RepertoireReportPieceRow[];
  months: RepertoireReportMonth[];
  /** Eventos com ao menos uma execução no período. */
  events: number;
};

export type RepertoireReportFilters = {
  from: Date;
  to: Date;
  /** Vazio = todos. Com vários, vale qualquer um deles. */
  groupIds: string[];
  eventTypeIds: string[];
  categoryIds: string[];
};

export const REPERTOIRE_REPORT_PERIODS = [
  'last_3_months',
  'last_6_months',
  'last_12_months',
  'this_year',
  'last_year',
] as const;

export type RepertoireReportPeriod = (typeof REPERTOIRE_REPORT_PERIODS)[number];

export const DEFAULT_REPERTOIRE_REPORT_PERIOD: RepertoireReportPeriod = 'last_12_months';

export function isRepertoireReportPeriod(value: string | null): value is RepertoireReportPeriod {
  return value !== null && (REPERTOIRE_REPORT_PERIODS as readonly string[]).includes(value);
}

/** Intervalo [from, to) em hora local, alinhado ao início dos meses. Inclui o mês corrente. */
export function resolveRepertoireReportRange(
  period: RepertoireReportPeriod,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const nextMonthStart = new Date(year, month + 1, 1);

  switch (period) {
    case 'last_3_months':
      return { from: new Date(year, month - 2, 1), to: nextMonthStart };
    case 'last_6_months':
      return { from: new Date(year, month - 5, 1), to: nextMonthStart };
    case 'last_12_months':
      return { from: new Date(year, month - 11, 1), to: nextMonthStart };
    case 'this_year':
      return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
    case 'last_year':
      return { from: new Date(year - 1, 0, 1), to: new Date(year, 0, 1) };
  }
}

export type RepertoireReportSummary = {
  pieceCount: number;
  performedPieceCount: number;
  /** Fração do acervo tocada no período (0–1). */
  performedShare: number;
  performances: number;
  events: number;
  neverPerformedCount: number;
};

export function summarizeRepertoireReport(report: RepertoireReport): RepertoireReportSummary {
  let performedPieceCount = 0;
  let performances = 0;
  let neverPerformedCount = 0;

  for (const piece of report.pieces) {
    performances += piece.performances;
    if (piece.performances > 0) {
      performedPieceCount += 1;
    }
    if (piece.lastPerformedAt === null) {
      neverPerformedCount += 1;
    }
  }

  const pieceCount = report.pieces.length;
  return {
    pieceCount,
    performedPieceCount,
    performedShare: pieceCount === 0 ? 0 : performedPieceCount / pieceCount,
    performances,
    events: report.events,
    neverPerformedCount,
  };
}

export function countPerformancesByCategory(
  pieces: readonly RepertoireReportPieceRow[],
): Map<string, number> {
  const byCategory = new Map<string, number>();
  for (const piece of pieces) {
    if (piece.performances === 0) {
      continue;
    }
    byCategory.set(piece.categoryId, (byCategory.get(piece.categoryId) ?? 0) + piece.performances);
  }
  return byCategory;
}

function compareTitles(a: RepertoireReportPieceRow, b: RepertoireReportPieceRow): number {
  return a.title.localeCompare(b.title, 'pt-BR');
}

/** Obras tocadas no período, da mais para a menos tocada. */
export function rankMostPerformedPieces(
  pieces: readonly RepertoireReportPieceRow[],
): RepertoireReportPieceRow[] {
  return pieces
    .filter((piece) => piece.performances > 0)
    .sort((a, b) => b.performances - a.performances || compareTitles(a, b));
}

/** Meses de calendário completos entre a data e `now` (0 = este mês). */
export function calendarMonthsSince(iso: string, now: Date = new Date()): number {
  const date = new Date(iso);
  return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
}

export const FORGOTTEN_PIECE_THRESHOLDS_MONTHS = [2, 3, 6, 12, 24] as const;
export const DEFAULT_FORGOTTEN_PIECE_THRESHOLD_MONTHS = 6;

/**
 * Obras já tocadas alguma vez, mas não nos últimos `thresholdMonths` meses,
 * da mais antiga para a mais recente.
 */
export function listForgottenPieces(
  pieces: readonly RepertoireReportPieceRow[],
  thresholdMonths: number,
  now: Date = new Date(),
): RepertoireReportPieceRow[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - thresholdMonths, now.getDate());
  return pieces
    .filter(
      (piece) => piece.lastPerformedAt !== null && new Date(piece.lastPerformedAt) < cutoff,
    )
    .sort(
      (a, b) =>
        new Date(a.lastPerformedAt as string).getTime() -
          new Date(b.lastPerformedAt as string).getTime() || compareTitles(a, b),
    );
}

export function listNeverPerformedPieces(
  pieces: readonly RepertoireReportPieceRow[],
): RepertoireReportPieceRow[] {
  return pieces.filter((piece) => piece.lastPerformedAt === null).sort(compareTitles);
}

export type RepertoireProgramStatusTotals = {
  performed: number;
  skipped: number;
  unmarked: number;
};

export function summarizeProgramStatus(
  pieces: readonly RepertoireReportPieceRow[],
): RepertoireProgramStatusTotals {
  const totals: RepertoireProgramStatusTotals = { performed: 0, skipped: 0, unmarked: 0 };
  for (const piece of pieces) {
    totals.performed += piece.performances;
    totals.skipped += piece.skipped;
    totals.unmarked += piece.unmarked;
  }
  return totals;
}
