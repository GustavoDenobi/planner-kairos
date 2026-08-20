import { Outlet } from 'react-router-dom';
import { DisplayPreferencesControls } from '@/ui/components/DisplayPreferencesControls';

export function PublicLayout() {
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
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
