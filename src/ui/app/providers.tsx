import type { ReactNode } from 'react';
import type { AppServices } from '@/ui/app/AppServicesContext';
import { AppServicesProvider } from '@/ui/app/AppServicesContext';
import { AuthProvider } from '@/ui/app/auth/AuthProvider';
import { LoadingBarAuthBridge, LoadingBarOrgBridge } from '@/ui/app/loading-bar/LoadingBarBridges';
import { LoadingBarProvider } from '@/ui/app/loading-bar/LoadingBarProvider';
import { OrgProvider } from '@/ui/app/OrgProvider';
import { ThemeProvider } from '@/ui/app/ThemeProvider';
import { UiScaleProvider } from '@/ui/app/UiScaleProvider';
import { PwaUpdateProvider } from '@/ui/features/pwa/PwaUpdateProvider';

type ProvidersProps = {
  children: ReactNode;
  services: AppServices;
};

export function Providers({ children, services }: ProvidersProps) {
  return (
    <AppServicesProvider services={services}>
      <LoadingBarProvider>
        <AuthProvider>
          <OrgProvider>
            <LoadingBarAuthBridge />
            <LoadingBarOrgBridge />
            <ThemeProvider>
              <UiScaleProvider>
                <PwaUpdateProvider>{children}</PwaUpdateProvider>
              </UiScaleProvider>
            </ThemeProvider>
          </OrgProvider>
        </AuthProvider>
      </LoadingBarProvider>
    </AppServicesProvider>
  );
}
