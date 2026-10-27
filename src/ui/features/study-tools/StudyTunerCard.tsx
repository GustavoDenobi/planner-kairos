import { useEffect } from 'react';
import { IconGauge } from '@/ui/components/icons';
import { PdfViewerTunerDisplay } from '@/ui/features/repertoire/PdfViewerTunerDisplay';
import {
  PdfViewerTranspositionModal,
  type PdfViewerTransposePartOption,
} from '@/ui/features/repertoire/PdfViewerTranspositionModal';
import {
  cycleTunerReferenceA4Hz,
  formatTunerReferenceA4Label,
  TUNER_REFERENCE_A4_OPTIONS,
} from '@/ui/features/repertoire/tuner-reference-a4';
import {
  TUNER_PITCH_MAX_HZ,
  TUNER_PITCH_MIN_HZ,
} from '@/ui/features/repertoire/tuner-pitch-detection';
import { useMicrophone } from '@/ui/features/repertoire/useMicrophone';
import { usePitch } from '@/ui/features/repertoire/usePitch';
import { useTunerTransposeControls } from '@/ui/features/study-tools/useTunerTransposeControls';

type StudyTunerCardProps = {
  userId: string | null;
  partOptions: PdfViewerTransposePartOption[];
  onRegisterMicStop?: (stop: (() => void) | null) => void;
  microphoneBlocked?: boolean;
};

const controlButtonClass =
  'inline-flex h-8 min-h-8 items-center justify-center truncate rounded-lg border px-2.5 text-xs leading-none sm:px-3 sm:text-sm';

export function StudyTunerCard({
  userId,
  partOptions,
  onRegisterMicStop,
  microphoneBlocked = false,
}: StudyTunerCardProps) {
  const {
    transposeModalOpen,
    setTransposeModalOpen,
    tunerTransposeSemitones,
    tunerTransposePartId,
    tunerReferenceA4Hz,
    handleTransposeSemitonesChange,
    handleTransposePartPresetChange,
    handleTunerReferenceA4Change,
    isTransposeActive,
    transposeButtonLabel,
    transposeCompactLabel,
    transposeButtonHint,
  } = useTunerTransposeControls({ userId, partOptions });

  const microphone = useMicrophone();
  const pitch = usePitch(microphone.analyser, {
    minHz: TUNER_PITCH_MIN_HZ,
    maxHz: TUNER_PITCH_MAX_HZ,
    reference: tunerReferenceA4Hz,
  });

  useEffect(() => () => microphone.stop(), [microphone.stop]);

  useEffect(() => {
    onRegisterMicStop?.(microphone.stop);
    return () => onRegisterMicStop?.(null);
  }, [microphone.stop, onRegisterMicStop]);

  useEffect(() => {
    if (microphoneBlocked) {
      microphone.stop();
    }
  }, [microphoneBlocked, microphone.stop]);

  const referenceLabel = formatTunerReferenceA4Label(tunerReferenceA4Hz);
  const referenceCycleHint = TUNER_REFERENCE_A4_OPTIONS.map((hz) => `${hz}`).join(' → ');

  return (
    <div className="h-full min-h-0">
      <section
        aria-labelledby="study-tuner-heading"
        className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-surface p-4 shadow-sm"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2
            id="study-tuner-heading"
            className="flex min-w-0 items-center gap-2 text-base font-semibold text-text"
          >
            <IconGauge className="h-5 w-5 shrink-0" aria-hidden />
            Afinador
          </h2>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setTransposeModalOpen(true)}
              aria-label={transposeButtonHint}
              aria-pressed={isTransposeActive}
              title={transposeButtonHint}
              className={`${controlButtonClass} max-w-[9.5rem] sm:max-w-[11rem] ${
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
              onClick={() =>
                handleTunerReferenceA4Change(cycleTunerReferenceA4Hz(tunerReferenceA4Hz))
              }
              aria-label={`Referência do Lá: ${tunerReferenceA4Hz} hertz. Clique para ciclar (${referenceCycleHint}).`}
              title={`Ciclar referência do Lá: ${referenceCycleHint} Hz`}
              className={`${controlButtonClass} shrink-0 border-border font-normal tabular-nums text-text`}
            >
              <span className="sm:hidden">{tunerReferenceA4Hz}</span>
              <span className="hidden sm:inline">{referenceLabel}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col justify-center">
          {microphone.isListening ? (
            <PdfViewerTunerDisplay
              source={pitch}
              transposeSemitones={tunerTransposeSemitones}
              referenceA4Hz={tunerReferenceA4Hz}
              tolerance={5}
              className="w-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-2 text-center">
              {microphone.error ? (
                <p className="text-sm text-muted">{microphone.error}</p>
              ) : null}
              {microphoneBlocked ? (
                <p className="text-sm text-muted">Encerre a gravação para usar o afinador.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void microphone.start()}
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Clique aqui para habilitar o microfone
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <PdfViewerTranspositionModal
        open={transposeModalOpen}
        onClose={() => setTransposeModalOpen(false)}
        partOptions={partOptions}
        semitones={tunerTransposeSemitones}
        selectedPartId={tunerTransposePartId}
        onSemitonesChange={handleTransposeSemitonesChange}
        onPartPresetChange={handleTransposePartPresetChange}
      />
    </div>
  );
}
