import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clampPartTransposeSemitones,
  formatTransposeKeyWithSemitones,
  transposeKeyPitchClass,
} from '@/domain/ensemble';
import {
  loadTunerTransposePreferences,
  saveTunerTransposePreferences,
} from '@/ui/features/repertoire/pdf-reader-preference-storage';
import type { PdfViewerTransposePartOption } from '@/ui/features/repertoire/PdfViewerTranspositionModal';
import {
  DEFAULT_TUNER_REFERENCE_A4_HZ,
  type TunerReferenceA4Hz,
} from '@/ui/features/repertoire/tuner-reference-a4';

type UseTunerTransposeControlsOptions = {
  userId: string | null;
  partOptions: PdfViewerTransposePartOption[];
};

export function useTunerTransposeControls({
  userId,
  partOptions,
}: UseTunerTransposeControlsOptions) {
  const [transposeModalOpen, setTransposeModalOpen] = useState(false);
  const [tunerTransposeSemitones, setTunerTransposeSemitones] = useState(0);
  const [tunerTransposePartId, setTunerTransposePartId] = useState<string | null>(null);
  const [tunerReferenceA4Hz, setTunerReferenceA4Hz] = useState<TunerReferenceA4Hz>(
    DEFAULT_TUNER_REFERENCE_A4_HZ,
  );

  useEffect(() => {
    if (!userId) {
      setTunerTransposeSemitones(0);
      setTunerTransposePartId(null);
      setTunerReferenceA4Hz(DEFAULT_TUNER_REFERENCE_A4_HZ);
      return;
    }
    const preferences = loadTunerTransposePreferences(userId);
    setTunerTransposeSemitones(preferences.tunerTransposeSemitones);
    setTunerTransposePartId(preferences.tunerTransposePartId);
    setTunerReferenceA4Hz(preferences.tunerReferenceA4Hz);
  }, [userId]);

  useEffect(() => {
    if (!userId || !tunerTransposePartId || partOptions.length === 0) {
      return;
    }
    if (partOptions.some((option) => option.id === tunerTransposePartId)) {
      return;
    }
    setTunerTransposePartId(null);
    saveTunerTransposePreferences(userId, { tunerTransposePartId: null });
  }, [partOptions, tunerTransposePartId, userId]);

  const handleTransposeSemitonesChange = useCallback(
    (nextSemitones: number) => {
      const clamped = clampPartTransposeSemitones(nextSemitones);
      setTunerTransposeSemitones(clamped);
      if (userId) {
        saveTunerTransposePreferences(userId, { tunerTransposeSemitones: clamped });
      }
    },
    [userId],
  );

  const handleTransposePartPresetChange = useCallback(
    (partId: string | null) => {
      setTunerTransposePartId(partId);
      if (partId === null) {
        setTunerTransposeSemitones(0);
        if (userId) {
          saveTunerTransposePreferences(userId, {
            tunerTransposePartId: null,
            tunerTransposeSemitones: 0,
          });
        }
        return;
      }

      const part = partOptions.find((option) => option.id === partId);
      const semitones = clampPartTransposeSemitones(part?.defaultTransposeSemitones ?? 0);
      setTunerTransposeSemitones(semitones);
      if (userId) {
        saveTunerTransposePreferences(userId, {
          tunerTransposePartId: partId,
          tunerTransposeSemitones: semitones,
        });
      }
    },
    [partOptions, userId],
  );

  const handleTunerReferenceA4Change = useCallback(
    (next: TunerReferenceA4Hz) => {
      setTunerReferenceA4Hz(next);
      if (userId) {
        saveTunerTransposePreferences(userId, { tunerReferenceA4Hz: next });
      }
    },
    [userId],
  );

  const tunerTransposePartName = useMemo(() => {
    if (!tunerTransposePartId) {
      return null;
    }
    return partOptions.find((option) => option.id === tunerTransposePartId)?.name ?? null;
  }, [tunerTransposePartId, partOptions]);

  const isTransposeActive = tunerTransposeSemitones !== 0 || tunerTransposePartId !== null;

  const transposeButtonLabel = useMemo(() => {
    if (!isTransposeActive) {
      return 'Transpor';
    }
    return `Transpor: ${transposeKeyPitchClass(tunerTransposeSemitones)}`;
  }, [isTransposeActive, tunerTransposeSemitones]);

  const transposeCompactLabel = useMemo(() => {
    if (!isTransposeActive) {
      return transposeKeyPitchClass(0);
    }
    return transposeKeyPitchClass(tunerTransposeSemitones);
  }, [isTransposeActive, tunerTransposeSemitones]);

  const transposeButtonHint = useMemo(() => {
    if (!isTransposeActive) {
      return 'Transpor';
    }
    const keyLabel = formatTransposeKeyWithSemitones(tunerTransposeSemitones);
    if (tunerTransposePartName) {
      return `${keyLabel} — ${tunerTransposePartName}`;
    }
    return keyLabel;
  }, [isTransposeActive, tunerTransposePartName, tunerTransposeSemitones]);

  return {
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
  };
}
