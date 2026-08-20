import type { ReactNode } from 'react';
import { PwaInstallContext } from '@/ui/features/pwa/PwaInstallContext';
import { PwaInstallModal } from '@/ui/features/pwa/PwaInstallModal';
import { usePwaInstall } from '@/ui/features/pwa/usePwaInstall';

type PwaInstallProviderProps = {
  children: ReactNode;
};

export function PwaInstallProvider({ children }: PwaInstallProviderProps) {
  const value = usePwaInstall();

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      <PwaInstallModal />
    </PwaInstallContext.Provider>
  );
}
