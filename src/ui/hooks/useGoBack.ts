import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function historyCanGoBack(): boolean {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' && idx > 0;
}

export function useGoBack(fallbackTo: string) {
  const navigate = useNavigate();

  return useCallback(() => {
    if (historyCanGoBack()) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  }, [navigate, fallbackTo]);
}
