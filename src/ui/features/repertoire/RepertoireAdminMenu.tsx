import type { ReactNode } from 'react';
import { IconFileText, IconPalette, IconTag } from '@/ui/components/icons';

export type RepertoireAdminSection = 'pieces' | 'categories' | 'themes';

type RepertoireAdminMenuProps = {
  onSelect: (section: RepertoireAdminSection) => void;
};

const MENU_ITEMS: {
  id: RepertoireAdminSection;
  label: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    id: 'pieces',
    label: 'Peças',
    description: 'Catálogo de partituras',
    icon: <IconFileText className="h-7 w-7 text-primary" />,
  },
  {
    id: 'categories',
    label: 'Categorias',
    description: 'Tipos de repertório',
    icon: <IconTag className="h-7 w-7 text-primary" />,
  },
  {
    id: 'themes',
    label: 'Temas',
    description: 'Gerenciar os temas',
    icon: <IconPalette className="h-7 w-7 text-primary" />,
  },
];

export function RepertoireAdminMenu({ onSelect }: RepertoireAdminMenuProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {MENU_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-4 text-center transition-colors hover:bg-bg"
        >
          {item.icon}
          <div>
            <p className="font-medium text-text">{item.label}</p>
            <p className="mt-0.5 text-xs text-muted">{item.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
