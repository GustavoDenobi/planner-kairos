import { describe, expect, it } from 'vitest';
import {
  calendarMonthsSince,
  countPerformancesByCategory,
  listForgottenPieces,
  listNeverPerformedPieces,
  rankMostPerformedPieces,
  resolveRepertoireReportRange,
  summarizeProgramStatus,
  summarizeRepertoireReport,
  type RepertoireReportPieceRow,
} from './repertoire-report';

function row(overrides: Partial<RepertoireReportPieceRow>): RepertoireReportPieceRow {
  return {
    pieceId: 'p',
    title: 'Obra',
    categoryId: 'hinos',
    performances: 0,
    skipped: 0,
    unmarked: 0,
    lastPerformedAt: null,
    ...overrides,
  };
}

const now = new Date(2026, 10, 17, 12);

const pieces = [
  row({ pieceId: 'a', title: 'Aguardo o Dia', performances: 5, lastPerformedAt: '2026-11-02T13:00:00Z' }),
  row({ pieceId: 'b', title: 'Brilha', categoryId: 'eruditas', performances: 5, skipped: 1, lastPerformedAt: '2026-10-02T13:00:00Z' }),
  row({ pieceId: 'c', title: 'Canon', categoryId: 'eruditas', unmarked: 2, lastPerformedAt: '2025-08-10T13:00:00Z' }),
  row({ pieceId: 'd', title: 'Doxologia', lastPerformedAt: '2026-03-10T13:00:00Z' }),
  row({ pieceId: 'e', title: 'Exulte' }),
];

describe('resolveRepertoireReportRange', () => {
  it('últimos 12 meses incluem o mês corrente e começam no dia 1', () => {
    const { from, to } = resolveRepertoireReportRange('last_12_months', now);
    expect(from).toEqual(new Date(2025, 11, 1));
    expect(to).toEqual(new Date(2026, 11, 1));
  });

  it('ano passado cobre o ano civil inteiro', () => {
    const { from, to } = resolveRepertoireReportRange('last_year', now);
    expect(from).toEqual(new Date(2025, 0, 1));
    expect(to).toEqual(new Date(2026, 0, 1));
  });
});

describe('summarizeRepertoireReport', () => {
  it('resume acervo, execuções e obras nunca tocadas', () => {
    const summary = summarizeRepertoireReport({ pieces, months: [], events: 7 });
    expect(summary).toEqual({
      pieceCount: 5,
      performedPieceCount: 2,
      performedShare: 0.4,
      performances: 10,
      events: 7,
      neverPerformedCount: 1,
    });
  });

  it('acervo vazio não divide por zero', () => {
    expect(summarizeRepertoireReport({ pieces: [], months: [], events: 0 }).performedShare).toBe(0);
  });
});

describe('rankMostPerformedPieces', () => {
  it('ordena por execuções e desempata pelo título', () => {
    expect(rankMostPerformedPieces(pieces).map((p) => p.pieceId)).toEqual(['a', 'b']);
  });
});

describe('countPerformancesByCategory', () => {
  it('soma execuções por categoria e ignora categorias sem execução', () => {
    const counts = countPerformancesByCategory([
      ...pieces,
      row({ pieceId: 'f', categoryId: 'natal' }),
    ]);
    expect(counts.get('hinos')).toBe(5);
    expect(counts.get('eruditas')).toBe(5);
    expect(counts.has('natal')).toBe(false);
  });
});

describe('listForgottenPieces', () => {
  it('lista obras tocadas antes do limite, da mais antiga para a mais recente', () => {
    expect(listForgottenPieces(pieces, 6, now).map((p) => p.pieceId)).toEqual(['c', 'd']);
    expect(listForgottenPieces(pieces, 12, now).map((p) => p.pieceId)).toEqual(['c']);
  });

  it('não inclui obras nunca tocadas', () => {
    expect(listForgottenPieces(pieces, 0, now).some((p) => p.pieceId === 'e')).toBe(false);
  });
});

describe('listNeverPerformedPieces', () => {
  it('lista só obras sem nenhuma execução', () => {
    expect(listNeverPerformedPieces(pieces).map((p) => p.pieceId)).toEqual(['e']);
  });
});

describe('summarizeProgramStatus', () => {
  it('soma tocadas, puladas e sem marcação', () => {
    expect(summarizeProgramStatus(pieces)).toEqual({ performed: 10, skipped: 1, unmarked: 2 });
  });
});

describe('calendarMonthsSince', () => {
  it('conta meses de calendário', () => {
    expect(calendarMonthsSince('2026-11-02T13:00:00Z', now)).toBe(0);
    expect(calendarMonthsSince('2025-08-10T13:00:00Z', now)).toBe(15);
  });
});
