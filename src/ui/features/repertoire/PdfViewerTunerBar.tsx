import { useEffect } from 'react';
import { PdfViewerTunerDisplay } from '@/ui/features/repertoire/PdfViewerTunerDisplay';
import {
  cycleTunerReferenceA4Hz,
  formatTunerReferenceA4Label,
  TUNER_REFERENCE_A4_OPTIONS,
  type TunerReferenceA4Hz,
} from '@/ui/features/repertoire/tuner-reference-a4';
import { useMicrophone } from '@/ui/features/repertoire/useMicrophone';
import { usePitch } from '@/ui/features/repertoire/usePitch';

type PdfViewerTunerBarProps = {
  transposeSemitones?: number;
  referenceA4Hz: TunerReferenceA4Hz;
  onReferenceA4Change: (next: TunerReferenceA4Hz) => void;
  transposeButtonLabel: string;
  transposeCompactLabel: string;
  transposeButtonHint: string;
  isTransposeActive: boolean;
  onOpenTranspose: () => void;
};

export function PdfViewerTunerBar({
  transposeSemitones = 0,
  referenceA4Hz,
  onReferenceA4Change,
  transposeButtonLabel,
  transposeCompactLabel,
  transposeButtonHint,
  isTransposeActive,
  onOpenTranspose,
}: PdfViewerTunerBarProps) {
  const microphone = useMicrophone();
  const pitch = usePitch(microphone.analyser, {
    minHz: 60,
    maxHz: 1200,
    reference: referenceA4Hz,
  });

  useEffect(() => {
    void microphone.start();
    return () => microphone.stop();
  }, [microphone.start, microphone.stop]);

  const referenceLabel = formatTunerReferenceA4Label(referenceA4Hz);
  const referenceCycleHint = TUNER_REFERENCE_A4_OPTIONS.map((hz) => `${hz}`).join(' → ');

  const handleReferenceClick = () => {
    onReferenceA4Change(cycleTunerReferenceA4Hz(referenceA4Hz));
  };

  const tunerBarButtonClass =
    'inline-flex h-8 min-w-8 items-center justify-center truncate rounded-lg border px-2.5 text-xs leading-none sm:max-w-[11rem]';
  const tunerBarButtonDesktopClass = 'max-w-[9.5rem] sm:max-w-[11rem]';

  return (
    <div className="flex w-full shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5 sm:gap-3">
      <div className="flex shrink-0 items-stretch gap-1.5">
        <button
          type="button"
          onClick={onOpenTranspose}
          aria-label={transposeButtonHint}
          aria-pressed={isTransposeActive}
          title={transposeButtonHint}
          className={`${tunerBarButtonClass} ${tunerBarButtonDesktopClass} ${
            isTransposeActive
              ? 'border-primary bg-primary/10 font-medium text-primary'
              : 'border-border font-normal text-text'
          }`}
        >
          <span className="sm:hidden">{transposeCompactLabel}</span>
          <span className="hidden sm:inline">{transposeButtonLabel}</span>
        </button>
        <button
          type="button"
          onClick={handleReferenceClick}
          aria-label={`Referência do Lá: ${referenceA4Hz} hertz. Clique para ciclar (${referenceCycleHint}).`}
          title={`Ciclar referência do Lá: ${referenceCycleHint} Hz`}
          className={`${tunerBarButtonClass} shrink-0 border-border px-2 font-normal tabular-nums text-text sm:px-2.5`}
        >
          <span className="sm:hidden">{referenceA4Hz}</span>
          <span className="hidden sm:inline">{referenceLabel}</span>
        </button>
      </div>

      {microphone.error ? (
        <p className="min-w-0 flex-1 py-0.5 text-center text-xs text-muted sm:text-left">
          {microphone.error}
        </p>
      ) : (
        <PdfViewerTunerDisplay
          source={pitch}
          transposeSemitones={transposeSemitones}
          referenceA4Hz={referenceA4Hz}
          tolerance={5}
          className="min-w-0 flex-1"
        />
      )}
    </div>
  );
}
