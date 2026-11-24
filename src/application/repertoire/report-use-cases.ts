import type { RepertoireReportRepository } from '@/application/ports/repertoire-report-repository';
import type { RepertoireReportFilters } from '@/domain/repertoire';
import { Result } from '@/domain/shared';

export async function loadRepertoireReport(
  reportRepo: RepertoireReportRepository,
  organizationId: string,
  filters: RepertoireReportFilters,
) {
  try {
    return Result.ok(await reportRepo.load(organizationId, filters));
  } catch {
    return Result.fail('load_failed');
  }
}
