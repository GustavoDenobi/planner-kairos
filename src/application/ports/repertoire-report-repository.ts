import type { RepertoireReport, RepertoireReportFilters } from '@/domain/repertoire';

export type RepertoireReportRepository = {
  load(organizationId: string, filters: RepertoireReportFilters): Promise<RepertoireReport>;
};
