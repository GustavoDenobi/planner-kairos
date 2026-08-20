import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readReturnTo } from '@/ui/navigation/return-to';

function historyCanGoBack(): boolean {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' && idx > 0;
}

export function useGoBack(fallbackTo: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const returnTo = readReturnTo(location.state);
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    if (historyCanGoBack()) {
      navigate(-1);
      return;
    }

    navigate(fallbackTo);
  }, [navigate, fallbackTo, location.state]);
}
