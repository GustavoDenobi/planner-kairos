import type { RepertoireReportRepository } from '@/application/ports/repertoire-report-repository';
import type { RepertoireReport } from '@/domain/repertoire';
import { supabase } from './client';

type ReportPayload = {
  pieces: {
    piece_id: string;
    title: string;
    category_id: string;
    performances: number;
    skipped: number;
    unmarked: number;
    last_performed_at: string | null;
  }[];
  months: { month: string; performances: number }[];
  events: number;
};

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
}

export function createRepertoireReportRepository(): RepertoireReportRepository {
  return {
    async load(organizationId, filters): Promise<RepertoireReport> {
      const { data, error } = await supabase.rpc('get_repertoire_report', {
        p_org_id: organizationId,
        p_from: filters.from.toISOString(),
        p_to: filters.to.toISOString(),
        p_group_ids: filters.groupIds,
        p_event_type_ids: filters.eventTypeIds,
        p_category_ids: filters.categoryIds,
        p_time_zone: browserTimeZone(),
      });

      if (error || !data) {
        throw new Error(error?.message ?? 'repertoire_report_failed');
      }

      const payload = data as unknown as ReportPayload;
      return {
        pieces: payload.pieces.map((piece) => ({
          pieceId: piece.piece_id,
          title: piece.title,
          categoryId: piece.category_id,
          performances: piece.performances,
          skipped: piece.skipped,
          unmarked: piece.unmarked,
          lastPerformedAt: piece.last_performed_at,
        })),
        months: payload.months,
        events: payload.events,
      };
    },
  };
}
