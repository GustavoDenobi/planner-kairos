import { createContext, useContext } from 'react';
import type { PwaInstallState } from '@/ui/features/pwa/usePwaInstall';

export const PwaInstallContext = createContext<PwaInstallState | null>(null);

export function usePwaInstallContext(): PwaInstallState {
  const context = useContext(PwaInstallContext);
  if (!context) {
    throw new Error('usePwaInstallContext must be used within PwaInstallProvider');
  }
  return context;
}
