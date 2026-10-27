import { useEffect, useState } from 'react';
import { Modal } from '@/ui/components/Modal';
import {
  adjustCountdownDraft,
  clampTimerSegment,
  COUNTDOWN_DURATION_PRESETS_MINUTES,
  isCountdownDurationValid,
} from '@/ui/features/study-tools/study-timer-format';

type StudyCountdownDurationModalProps = {
  open: boolean;
  onClose: () => void;
  minutes: number;
  seconds: number;
  onConfirm: (minutes: number, seconds: number) => void;
};

const stepperButtonClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-lg text-text disabled:opacity-40';

type DurationStepperProps = {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseDisabled?: boolean;
  increaseDisabled?: boolean;
};

function DurationStepper({
  label,
  value,
  onDecrease,
  onIncrease,
  decreaseDisabled = false,
  increaseDisabled = false,
}: DurationStepperProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text">{label}</span>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onDecrease}
          disabled={decreaseDisabled}
          aria-label={`Diminuir ${label.toLowerCase()}`}
          className={stepperButtonClass}
        >
          −
        </button>
        <span
          aria-live="polite"
          className="inline-flex h-10 min-w-12 items-center justify-center tabular-nums text-2xl font-semibold text-text"
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onIncrease}
          disabled={increaseDisabled}
          aria-label={`Aumentar ${label.toLowerCase()}`}
          className={stepperButtonClass}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function StudyCountdownDurationModal({
  open,
  onClose,
  minutes,
  seconds,
  onConfirm,
}: StudyCountdownDurationModalProps) {
  const [draftMinutes, setDraftMinutes] = useState(minutes);
  const [draftSeconds, setDraftSeconds] = useState(seconds);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftMinutes(minutes);
    setDraftSeconds(seconds);
  }, [minutes, open, seconds]);

  const durationValid = isCountdownDurationValid(draftMinutes, draftSeconds);
  const atMax = draftMinutes >= 99 && draftSeconds >= 59;
  const atMin = draftMinutes === 0 && draftSeconds === 0;

  function applyDraft(nextMinutes: number, nextSeconds: number) {
    setDraftMinutes(clampTimerSegment(nextMinutes, 99));
    setDraftSeconds(clampTimerSegment(nextSeconds, 59));
  }

  function handleConfirm() {
    if (!durationValid) {
      return;
    }
    onConfirm(clampTimerSegment(draftMinutes, 99), clampTimerSegment(draftSeconds, 59));
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Tempo regressivo" size="md">
      <div className="flex flex-col gap-5">

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text">Atalhos</span>
          <div className="flex flex-wrap gap-2">
            {COUNTDOWN_DURATION_PRESETS_MINUTES.map((preset) => {
              const selected = draftMinutes === preset && draftSeconds === 0;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => applyDraft(preset, 0)}
                  className={`rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-colors ${
                    selected
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border text-text hover:bg-bg'
                  }`}
                >
                  {preset} min
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DurationStepper
            label="Minutos"
            value={draftMinutes}
            onDecrease={() => {
              const next = adjustCountdownDraft(draftMinutes, draftSeconds, -1, 0);
              applyDraft(next.minutes, next.seconds);
            }}
            onIncrease={() => {
              const next = adjustCountdownDraft(draftMinutes, draftSeconds, 1, 0);
              applyDraft(next.minutes, next.seconds);
            }}
            decreaseDisabled={atMin}
            increaseDisabled={atMax}
          />
          <DurationStepper
            label="Segundos"
            value={draftSeconds}
            onDecrease={() => {
              const next = adjustCountdownDraft(draftMinutes, draftSeconds, 0, -1);
              applyDraft(next.minutes, next.seconds);
            }}
            onIncrease={() => {
              const next = adjustCountdownDraft(draftMinutes, draftSeconds, 0, 1);
              applyDraft(next.minutes, next.seconds);
            }}
            decreaseDisabled={atMin}
            increaseDisabled={atMax}
          />
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!durationValid}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          Concluir
        </button>
      </div>
    </Modal>
  );
}
