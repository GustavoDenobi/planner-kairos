import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { TopLoadingBar } from '@/ui/components/TopLoadingBar';

export type LoadingBarPlacement = 'default' | 'belowAppHeader' | 'belowReaderHeader';

type LoadingBarContextValue = {
  isLoading: boolean;
  placement: LoadingBarPlacement;
  register: (id: string) => void;
  unregister: (id: string) => void;
  setPlacement: (placement: LoadingBarPlacement) => void;
};

const LoadingBarContext = createContext<LoadingBarContextValue | null>(null);

export function LoadingBarProvider({ children }: { children: ReactNode }) {
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set());
  const [placement, setPlacementState] = useState<LoadingBarPlacement>('default');

  const register = useCallback((id: string) => {
    setActiveIds((prev) => {
      if (prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setActiveIds((prev) => {
      if (!prev.has(id)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const setPlacement = useCallback((next: LoadingBarPlacement) => {
    setPlacementState(next);
  }, []);

  const value = useMemo(
    () => ({
      isLoading: activeIds.size > 0,
      placement,
      register,
      unregister,
      setPlacement,
    }),
    [activeIds, placement, register, unregister, setPlacement],
  );

  return (
    <LoadingBarContext.Provider value={value}>
      {children}
      <TopLoadingBar isLoading={value.isLoading} placement={placement} />
    </LoadingBarContext.Provider>
  );
}

export function useLoadingBarContext() {
  const ctx = useContext(LoadingBarContext);
  if (!ctx) {
    throw new Error('useLoadingBarContext must be used within LoadingBarProvider');
  }
  return ctx;
}
