import { createContext, useContext, type ReactNode } from 'react';
import type { EnsembleUseCases } from '@/application/ensemble';
import type { IdentityUseCases } from '@/application/identity';
import type { RepertoireUseCases } from '@/application/repertoire';

export type AppServices = {
  identity: IdentityUseCases;
  ensemble: EnsembleUseCases;
  repertoire: RepertoireUseCases;
};

const AppServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  return (
    <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>
  );
}

export function useAppServices(): AppServices {
  const ctx = useContext(AppServicesContext);
  if (!ctx) {
    throw new Error('useAppServices must be used within AppServicesProvider');
  }
  return ctx;
}

export function useIdentity() {
  return useAppServices().identity;
}

export function useEnsemble() {
  return useAppServices().ensemble;
}

export function useRepertoire() {
  return useAppServices().repertoire;
}
