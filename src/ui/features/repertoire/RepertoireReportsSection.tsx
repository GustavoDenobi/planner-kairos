import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EventType } from '@/domain/agenda';
import {
  DEFAULT_FORGOTTEN_PIECE_THRESHOLD_MONTHS,
  DEFAULT_REPERTOIRE_REPORT_PERIOD,
  REPERTOIRE_REPORT_PERIODS,
  isRepertoireReportPeriod,
  resolveRepertoireReportRange,
  type PieceCategory,
  type RepertoireReport,
  type RepertoireReportPeriod,
} from '@/domain/repertoire';
import { useAgenda, useRepertoire } from '@/ui/app/AppServicesContext';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { MultiSelectDropdown } from '@/ui/components/MultiSelectDropdown';
import { Skeleton } from '@/ui/components/Skeleton';
import { Tabs } from '@/ui/components/Tabs';
import { RepertoireReportOverviewTab } from '@/ui/features/repertoire/RepertoireReportOverviewTab';
import { RepertoireReportPerformancesTab } from '@/ui/features/repertoire/RepertoireReportPerformancesTab';
import {
  REPERTOIRE_REPORT_PERIOD_LABELS,
  REPERTOIRE_REPORT_TABS,
  REPERTOIRE_REPORT_TAB_QUERY,
  parseRepertoireReportTab,
  type RepertoireReportTabId,
} from '@/ui/features/repertoire/repertoire-report-labels';
import {
  loadRepertoireReportFilters,
  saveRepertoireReportFilters,
  type RepertoireReportFilters,
} from '@/ui/features/repertoire/repertoire-report-filters-storage';

const PERIOD_QUERY = 'periodo';

type RepertoireReportsSectionProps = {
  organizationId: string;
  orgSlug: string;
  categories: PieceCategory[];
  groups: { id: string; name: string }[];
};

export function RepertoireReportsSection({
  organizationId,
  orgSlug,
  categories,
  groups,
}: RepertoireReportsSectionProps) {
  const repertoire = useRepertoire();
  const agenda = useAgenda();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = parseRepertoireReportTab(searchParams.get(REPERTOIRE_REPORT_TAB_QUERY));
  const periodParam = searchParams.get(PERIOD_QUERY);
  const period: RepertoireReportPeriod = isRepertoireReportPeriod(periodParam)
    ? periodParam
    : DEFAULT_REPERTOIRE_REPORT_PERIOD;

  const [storedFilters] = useState(() => loadRepertoireReportFilters(organizationId));
  const [groupIds, setGroupIds] = useState<string[]>(storedFilters?.groupIds ?? []);
  const [eventTypeIds, setEventTypeIds] = useState<string[]>(storedFilters?.eventTypeIds ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(storedFilters?.categoryIds ?? []);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [report, setReport] = useState<RepertoireReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Compartilhado entre as abas: "Ver todas" na visão geral mantém o limite escolhido.
  const [forgottenThreshold, setForgottenThreshold] = useState<number>(
    DEFAULT_FORGOTTEN_PIECE_THRESHOLD_MONTHS,
  );

  useLoadingBar('repertoire-report', isLoading);

  const updateQuery = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === null) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Sem período na URL, restaura o último período salvo (a URL continua sendo a fonte da verdade).
  useEffect(() => {
    if (
      periodParam === null &&
      storedFilters &&
      storedFilters.period !== DEFAULT_REPERTOIRE_REPORT_PERIOD
    ) {
      updateQuery(PERIOD_QUERY, storedFilters.period);
    }
    // Só na montagem: depois disso o período segue as escolhas do usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva só quando o usuário muda algo, para o TTL de 24h contar a partir da última escolha.
  const lastSavedFiltersRef = useRef(storedFilters ? JSON.stringify(storedFilters) : null);
  const pendingPeriodRestoreRef = useRef(
    periodParam === null &&
      storedFilters !== null &&
      storedFilters.period !== DEFAULT_REPERTOIRE_REPORT_PERIOD,
  );
  useEffect(() => {
    if (pendingPeriodRestoreRef.current) {
      if (period !== storedFilters?.period) {
        return;
      }
      pendingPeriodRestoreRef.current = false;
    }
    const filters = { period, groupIds, eventTypeIds, categoryIds };
    const serialized = JSON.stringify(filters);
    if (serialized === lastSavedFiltersRef.current) {
      return;
    }
    if (lastSavedFiltersRef.current === null && !hasActiveFilters(filters)) {
      return;
    }
    lastSavedFiltersRef.current = serialized;
    saveRepertoireReportFilters(organizationId, filters);
  }, [organizationId, storedFilters, period, groupIds, eventTypeIds, categoryIds]);

  useEffect(() => {
    let cancelled = false;
    void agenda.listEventTypes(organizationId).then((result) => {
      if (!cancelled && result.ok) {
        setEventTypes(result.value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [agenda, organizationId]);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = resolveRepertoireReportRange(period);
    setIsLoading(true);
    setHasError(false);

    void repertoire
      .loadRepertoireReport(organizationId, {
        from,
        to,
        groupIds,
        eventTypeIds,
        categoryIds,
      })
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.ok) {
          setReport(result.value);
        } else {
          setHasError(true);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repertoire, organizationId, period, groupIds, eventTypeIds, categoryIds, reloadKey]);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const selectClass = 'w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text';

  function renderTabContent(tabId: RepertoireReportTabId) {
    if (hasError) {
      return (
        <div className="rounded-xl border border-border bg-surface px-4 py-6 text-center">
          <p className="text-sm text-text">Não foi possível carregar o relatório.</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white"
          >
            Tentar de novo
          </button>
        </div>
      );
    }

    if (!report) {
      return <ReportSkeleton />;
    }

    return (
      <div className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        {tabId === 'visao-geral' ? (
          <RepertoireReportOverviewTab
            report={report}
            orgSlug={orgSlug}
            categories={categories}
            categoriesById={categoriesById}
            onOpenPerformances={() => updateQuery(REPERTOIRE_REPORT_TAB_QUERY, 'execucoes')}
            forgottenThreshold={forgottenThreshold}
            onForgottenThresholdChange={setForgottenThreshold}
          />
        ) : (
          <RepertoireReportPerformancesTab
            report={report}
            orgSlug={orgSlug}
            categoriesById={categoriesById}
            forgottenThreshold={forgottenThreshold}
            onForgottenThresholdChange={setForgottenThreshold}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section
        aria-label="Filtros do relatório"
        className="grid gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Período</span>
          <select
            value={period}
            onChange={(event) =>
              updateQuery(
                PERIOD_QUERY,
                event.target.value === DEFAULT_REPERTOIRE_REPORT_PERIOD ? null : event.target.value,
              )
            }
            className={selectClass}
          >
            {REPERTOIRE_REPORT_PERIODS.map((value) => (
              <option key={value} value={value}>
                {REPERTOIRE_REPORT_PERIOD_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted">Grupo</span>
          <MultiSelectDropdown
            label="Grupo"
            options={groups.map((group) => ({ value: group.id, label: group.name }))}
            selected={groupIds}
            onChange={setGroupIds}
            allLabel="Todos os grupos"
            pluralLabel={(count) => `${count} grupos`}
          />
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted">Tipo de evento</span>
          <MultiSelectDropdown
            label="Tipo de evento"
            options={eventTypes.map((eventType) => ({ value: eventType.id, label: eventType.name }))}
            selected={eventTypeIds}
            onChange={setEventTypeIds}
            allLabel="Todos os tipos"
            pluralLabel={(count) => `${count} tipos`}
          />
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted">Categoria</span>
          <MultiSelectDropdown
            label="Categoria"
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            selected={categoryIds}
            onChange={setCategoryIds}
            allLabel="Todas as categorias"
            pluralLabel={(count) => `${count} categorias`}
          />
        </div>
      </section>

      <Tabs
        activeTab={activeTab}
        onTabChange={(tabId) =>
          updateQuery(REPERTOIRE_REPORT_TAB_QUERY, tabId === 'visao-geral' ? null : tabId)
        }
        tabs={REPERTOIRE_REPORT_TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          content: renderTabContent(tab.id),
        }))}
      />
    </div>
  );
}

function hasActiveFilters(filters: RepertoireReportFilters): boolean {
  return (
    filters.period !== DEFAULT_REPERTOIRE_REPORT_PERIOD ||
    filters.groupIds.length > 0 ||
    filters.eventTypeIds.length > 0 ||
    filters.categoryIds.length > 0
  );
}

function ReportSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only">Carregando relatório</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
