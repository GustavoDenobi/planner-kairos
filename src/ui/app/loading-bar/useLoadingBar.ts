import { useEffect } from 'react';
import type { LoadingBarPlacement } from '@/ui/app/loading-bar/LoadingBarProvider';
import { useLoadingBarContext } from '@/ui/app/loading-bar/LoadingBarProvider';

export function useLoadingBar(id: string, active: boolean) {
  const { register, unregister } = useLoadingBarContext();

  useEffect(() => {
    if (active) {
      register(id);
      return () => unregister(id);
    }
    unregister(id);
    return undefined;
  }, [active, id, register, unregister]);
}

export function useLoadingBarPlacement(placement: LoadingBarPlacement) {
  const { setPlacement } = useLoadingBarContext();

  useEffect(() => {
    setPlacement(placement);
    return () => setPlacement('default');
  }, [placement, setPlacement]);
}
