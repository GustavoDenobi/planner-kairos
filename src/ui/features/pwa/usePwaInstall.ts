import { useCallback, useEffect, useRef, useState } from 'react';
import {
  detectPwaInstallContextFromWindow,
  shouldShowPwaInstallPrompt,
  type PwaInstallContextKind,
} from '@/ui/features/pwa/detect-pwa-install-context';
import { dismissPwaInstall, isPwaInstallDismissed } from '@/ui/features/pwa/pwa-install-storage';

export type PwaInstallState = {
  kind: PwaInstallContextKind;
  visible: boolean;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  dismissSession: () => void;
  promptNativeInstall: () => Promise<void>;
};

export function usePwaInstall(): PwaInstallState {
  const [kind, setKind] = useState<PwaInstallContextKind>(() =>
    typeof window === 'undefined' ? 'unsupported' : detectPwaInstallContextFromWindow(),
  );
  const [dismissed, setDismissed] = useState(() =>
    typeof window === 'undefined' ? false : isPwaInstallDismissed(),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: BeforeInstallPromptEvent) {
      event.preventDefault();
      deferredPromptRef.current = event;
      setKind((current) =>
        current === 'installed' || current === 'samsung-internet' ? current : 'native',
      );
    }

    function handleAppInstalled() {
      deferredPromptRef.current = null;
      setKind('installed');
      setModalOpen(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const openModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const dismissSession = useCallback(() => {
    dismissPwaInstall();
    setDismissed(true);
    setModalOpen(false);
  }, []);

  const promptNativeInstall = useCallback(async () => {
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPromptRef.current = null;
      if (choice.outcome === 'accepted') {
        setKind('installed');
        setModalOpen(false);
      }
    } catch {
      deferredPromptRef.current = null;
    }
  }, []);

  return {
    kind,
    visible: !dismissed && shouldShowPwaInstallPrompt(kind),
    modalOpen,
    openModal,
    closeModal,
    dismissSession,
    promptNativeInstall,
  };
}
