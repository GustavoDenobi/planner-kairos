import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  billingStatus,
  daysBetween,
  suggestedNextDueDate,
} from '@/domain/platform/billing';

describe('addMonths', () => {
  it('mantém o dia quando o mês de destino comporta', () => {
    expect(addMonths('2026-03-10', 1)).toBe('2026-04-10');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('usa o último dia quando o mês de destino é mais curto', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('vira o ano', () => {
    expect(addMonths('2026-12-05', 1)).toBe('2027-01-05');
    expect(addMonths('2026-06-05', 12)).toBe('2027-06-05');
  });
});

describe('daysBetween / addDays', () => {
  it('conta dias de calendário', () => {
    expect(daysBetween('2026-02-27', '2026-03-02')).toBe(3);
    expect(daysBetween('2026-03-02', '2026-02-27')).toBe(-3);
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
  });
});

describe('billingStatus', () => {
  const base = { isActive: true, nextDueDate: '2026-11-20', graceDays: 7 };

  it('sem cobrança ou encerrada é not_billed', () => {
    expect(billingStatus(null, '2026-11-10')).toBe('not_billed');
    expect(billingStatus({ ...base, isActive: false }, '2026-12-31')).toBe('not_billed');
  });

  it('em dia quando falta mais de 5 dias', () => {
    expect(billingStatus(base, '2026-11-14')).toBe('current');
  });

  it('vence em breve até o próprio dia do vencimento', () => {
    expect(billingStatus(base, '2026-11-15')).toBe('due_soon');
    expect(billingStatus(base, '2026-11-20')).toBe('due_soon');
  });

  it('carência depois do vencimento, até graceDays', () => {
    expect(billingStatus(base, '2026-11-21')).toBe('grace');
    expect(billingStatus(base, '2026-11-27')).toBe('grace');
  });

  it('em atraso depois da carência', () => {
    expect(billingStatus(base, '2026-11-28')).toBe('overdue');
    expect(billingStatus({ ...base, graceDays: 0 }, '2026-11-21')).toBe('overdue');
  });
});

describe('suggestedNextDueDate', () => {
  it('avança um ciclo a partir do vencimento atual', () => {
    expect(suggestedNextDueDate({ nextDueDate: '2026-11-20', cycleMonths: 1 })).toBe('2026-12-20');
    expect(suggestedNextDueDate({ nextDueDate: '2026-11-20', cycleMonths: 12 })).toBe('2027-11-20');
  });
});
