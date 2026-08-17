import type { ReactNode } from 'react';
import type { AppServices } from '@/ui/app/AppServicesContext';
import { AppServicesProvider } from '@/ui/app/AppServicesContext';
import { AuthProvider } from '@/ui/app/auth/AuthProvider';
import { OrgProvider } from '@/ui/app/OrgProvider';
import { ThemeProvider } from '@/ui/app/ThemeProvider';

type ProvidersProps = {
  children: ReactNode;
  services: AppServices;
};

export function Providers({ children, services }: ProvidersProps) {
  return (
    <AppServicesProvider services={services}>
      <AuthProvider>
        <OrgProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </OrgProvider>
      </AuthProvider>
    </AppServicesProvider>
  );
}
