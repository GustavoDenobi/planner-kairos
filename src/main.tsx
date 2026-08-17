import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/ui/app/App';
import { Providers } from '@/ui/app/providers';
import '@/ui/theme/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
