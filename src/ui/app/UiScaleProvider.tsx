import type { ReactNode } from 'react';
import { UiScaleContext } from '@/ui/app/uiScaleContext';
import { useUiScaleState } from '@/ui/app/useUiScaleState';

type UiScaleProviderProps = {
  children: ReactNode;
};

export function UiScaleProvider({ children }: UiScaleProviderProps) {
  const value = useUiScaleState();

  return <UiScaleContext.Provider value={value}>{children}</UiScaleContext.Provider>;
}
