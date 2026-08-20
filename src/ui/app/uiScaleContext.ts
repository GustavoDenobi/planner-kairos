import { createContext } from 'react';
import type { UiScaleContextValue } from '@/ui/app/useUiScaleState';

export const UiScaleContext = createContext<UiScaleContextValue | null>(null);
