import { useEffect, useState } from 'react';
import { ensureSmuflFontLoaded } from '@/ui/features/repertoire/smufl-font-loader';

export function useEnsureSmuflFont(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void ensureSmuflFontLoaded().then((loaded) => {
      if (!cancelled) {
        setReady(loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
