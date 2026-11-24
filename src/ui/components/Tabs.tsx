import type { ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  tabs: TabItem[];
  defaultTab?: string;
  className?: string;
  panelClassName?: string;
  /** Modo controlado: aba ativa vinda de fora (ex.: da URL). */
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  /**
   * Modo não controlado: parâmetro da URL que guarda a aba ativa, para que voltar a
   * esta página (ex.: do detalhe de um item aberto na aba) reabra a mesma aba.
   */
  urlParam?: string;
};

const DEFAULT_TAB_URL_PARAM = 'aba';

export function Tabs({
  tabs,
  defaultTab,
  className = '',
  panelClassName = '',
  activeTab: controlledTab,
  onTabChange,
  urlParam = DEFAULT_TAB_URL_PARAM,
}: TabsProps) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const fallbackTab = defaultTab ?? tabs[0]?.id;
  const urlTab = searchParams.get(urlParam);
  const uncontrolledTab = tabs.some((tab) => tab.id === urlTab) ? urlTab : fallbackTab;
  const activeTab = controlledTab ?? uncontrolledTab;
  const setActiveTab = (tabId: string) => {
    if (controlledTab === undefined) {
      const next = new URLSearchParams(searchParams);
      if (tabId === fallbackTab) {
        next.delete(urlParam);
      } else {
        next.set(urlParam, tabId);
      }
      // Trocar de aba não vira entrada no histórico: voltar sai da página.
      setSearchParams(next, { replace: true, state: location.state });
    }
    onTabChange?.(tabId);
  };
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  if (!active) {
    return null;
  }

  return (
    <div className={className}>
      <div role="tablist" className="-mb-px flex shrink-0 gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className={`mt-4 min-h-0 ${panelClassName}`.trim()}>
        {active.content}
      </div>
    </div>
  );
}
