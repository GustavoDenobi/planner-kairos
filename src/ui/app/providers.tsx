import type { ReactNode } from 'react';
import { ThemeProvider } from '@/ui/app/ThemeProvider';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
