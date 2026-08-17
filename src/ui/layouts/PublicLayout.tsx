import { Outlet } from 'react-router-dom';
import { ThemeToggle } from '@/ui/components/ThemeToggle';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
