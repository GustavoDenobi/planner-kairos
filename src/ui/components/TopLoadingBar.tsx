import type { LoadingBarPlacement } from '@/ui/app/loading-bar/LoadingBarProvider';

type TopLoadingBarProps = {
  isLoading: boolean;
  placement: LoadingBarPlacement;
};

const placementClass: Record<LoadingBarPlacement, string> = {
  default: 'top-0',
  belowAppHeader: 'top-[3.5rem] md:top-0',
  belowReaderHeader: 'top-[3.5rem] md:top-0',
};

export function TopLoadingBar({ isLoading, placement }: TopLoadingBarProps) {
  return (
    <div
      className={`fixed inset-x-0 z-30 h-0.5 pointer-events-none transition-opacity duration-200 ${placementClass[placement]} ${
        isLoading ? 'opacity-100' : 'opacity-0'
      }`}
      role="progressbar"
      aria-busy={isLoading}
      aria-hidden={!isLoading}
    >
      <div className="relative h-full overflow-hidden bg-primary/20">
        <div className="top-loading-bar-indicator absolute inset-y-0 w-1/3 bg-primary" />
      </div>
    </div>
  );
}
