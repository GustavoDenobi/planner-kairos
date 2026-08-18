import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { createAppServices } from '@/composition';
import { App } from '@/ui/app/App';
import { AppBootstrap } from '@/ui/app/AppBootstrap';
import { Providers } from '@/ui/app/providers';
import '@/ui/theme/globals.css';

registerSW({ immediate: true });

const services = createAppServices();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers services={services}>
      <AppBootstrap>
        <App />
      </AppBootstrap>
    </Providers>
  </StrictMode>,
);
