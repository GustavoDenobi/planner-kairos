import { type ReactNode, useState } from 'react';

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

type TabsProps = {
  tabs: TabItem[];
  defaultTab?: string;
};

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id);
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  if (!active) {
    return null;
  }

  return (
    <div>
      <div role="tablist" className="-mb-px flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
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
      <div role="tabpanel" className="mt-6">
        {active.content}
      </div>
    </div>
  );
}
