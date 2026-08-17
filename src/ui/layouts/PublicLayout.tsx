import { Outlet } from 'react-router-dom';
import { ThemeToggle } from '@/ui/components/ThemeToggle';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle variant="compact" />
      </div>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
