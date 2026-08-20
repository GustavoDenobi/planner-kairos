import { useContext } from 'react';
import { UiScaleContext } from '@/ui/app/uiScaleContext';

export function useUiScale() {
  const context = useContext(UiScaleContext);
  if (!context) {
    throw new Error('useUiScale must be used within UiScaleProvider');
  }
  return context;
}
