import { Outlet, useLocation } from 'react-router-dom';
import { DisplayPreferencesControls } from '@/ui/components/DisplayPreferencesControls';
import { PublicPrivacyFooter } from '@/ui/components/PublicPrivacyFooter';

export function PublicLayout() {
  const { pathname } = useLocation();
  const isLegalDocumentPage = pathname === '/privacidade' || pathname === '/termos';

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <div
        className="fixed z-50"
        style={{
          top: 'max(1rem, var(--safe-area-top))',
          right: 'max(1rem, var(--safe-area-right))',
        }}
      >
        <DisplayPreferencesControls variant="compact" />
      </div>
      <main
        className={
          isLegalDocumentPage
            ? 'flex flex-1 flex-col items-stretch justify-start p-4 pt-8'
            : 'flex flex-1 items-center justify-center p-4'
        }
      >
        <div className={isLegalDocumentPage ? 'mx-auto w-full max-w-3xl' : 'w-full max-w-md'}>
          <Outlet />
        </div>
      </main>
      <PublicPrivacyFooter />
    </div>
  );
}
