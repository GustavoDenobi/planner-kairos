import { useEffect, useRef, useState, type ReactNode } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { PwaUpdateModal } from '@/ui/features/pwa/PwaUpdateModal';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

type PwaUpdateProviderProps = {
  children: ReactNode;
};

export function PwaUpdateProvider({ children }: PwaUpdateProviderProps) {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [updating, setUpdating] = useState(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | undefined>(undefined);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedsRefresh(true);
      },
      onRegisteredSW(_swUrl, registration) {
        cleanupRef.current?.();

        if (!registration) {
          return;
        }

        const checkForUpdates = () => {
          void registration.update().catch(() => {});
        };

        const interval = window.setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            checkForUpdates();
          }
        };

        window.addEventListener('focus', checkForUpdates);
        document.addEventListener('visibilitychange', onVisibilityChange);

        cleanupRef.current = () => {
          window.clearInterval(interval);
          window.removeEventListener('focus', checkForUpdates);
          document.removeEventListener('visibilitychange', onVisibilityChange);
        };
      },
    });

    updateSWRef.current = updateSW;

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = undefined;
    };
  }, []);

  const handleUpdate = () => {
    setUpdating(true);
    void updateSWRef.current?.(true);
  };

  return (
    <>
      {children}
      {needsRefresh ? <PwaUpdateModal updating={updating} onUpdate={handleUpdate} /> : null}
    </>
  );
}
