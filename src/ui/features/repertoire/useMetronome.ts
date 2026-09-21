import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_METRONOME_BEATS,
  DEFAULT_METRONOME_BPM,
  DEFAULT_METRONOME_VOLUME,
  loadMetronomePreferences,
  saveMetronomePreferences,
} from '@/ui/features/repertoire/pdf-reader-preference-storage';
import {
  clampMetronomeBpm,
  MetronomeEngine,
  METRONOME_MAX_BPM,
  METRONOME_MIN_BPM,
  type MetronomeBeatsPerMeasure,
} from '@/ui/features/repertoire/metronome-engine';
import { registerTapTempo } from '@/ui/features/repertoire/tap-tempo';

type UseMetronomeOptions = {
  userId: string | null;
};

export function useMetronome({ userId }: UseMetronomeOptions) {
  const engineRef = useRef<MetronomeEngine | null>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimestampsRef = useRef<number[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [beatPulse, setBeatPulse] = useState(0);
  const [downbeatPulse, setDownbeatPulse] = useState(false);
  const beatPulseTimeoutsRef = useRef<number[]>([]);
  const [bpm, setBpmState] = useState(DEFAULT_METRONOME_BPM);
  const [beatsPerMeasure, setBeatsPerMeasureState] = useState<MetronomeBeatsPerMeasure>(
    DEFAULT_METRONOME_BEATS,
  );
  const [volume, setVolumeState] = useState(DEFAULT_METRONOME_VOLUME);

  const persistPreferences = useCallback(
    (
      patch: Partial<{
        metronomeBpm: number;
        metronomeBeatsPerMeasure: number;
        metronomeVolume: number;
      }>,
    ) => {
      if (!userId) {
        return;
      }

      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }

      persistTimeoutRef.current = setTimeout(() => {
        saveMetronomePreferences(userId, patch);
      }, 300);
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setBpmState(DEFAULT_METRONOME_BPM);
      setBeatsPerMeasureState(DEFAULT_METRONOME_BEATS);
      setVolumeState(DEFAULT_METRONOME_VOLUME);
      return;
    }

    const preferences = loadMetronomePreferences(userId);
    setBpmState(preferences.metronomeBpm ?? DEFAULT_METRONOME_BPM);
    setBeatsPerMeasureState(
      (preferences.metronomeBeatsPerMeasure ?? DEFAULT_METRONOME_BEATS) as MetronomeBeatsPerMeasure,
    );
    setVolumeState(preferences.metronomeVolume ?? DEFAULT_METRONOME_VOLUME);
  }, [userId]);

  const clearBeatPulseTimeouts = useCallback(() => {
    for (const timeoutId of beatPulseTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    beatPulseTimeoutsRef.current = [];
  }, []);

  const scheduleBeatPulse = useCallback((beatIndex: number, delaySec: number) => {
    const timeoutId = window.setTimeout(() => {
      beatPulseTimeoutsRef.current = beatPulseTimeoutsRef.current.filter((id) => id !== timeoutId);
      setDownbeatPulse(beatIndex === 0);
      setBeatPulse((value) => value + 1);
    }, Math.max(0, delaySec) * 1000);
    beatPulseTimeoutsRef.current.push(timeoutId);
  }, []);

  const ensureEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine({
        bpm,
        beatsPerMeasure,
        volume,
      });
    } else {
      engineRef.current.setBpm(bpm);
      engineRef.current.setBeatsPerMeasure(beatsPerMeasure);
      engineRef.current.setVolume(volume);
    }

    engineRef.current.setOnBeat((beatIndex, delaySec) => {
      scheduleBeatPulse(beatIndex, delaySec);
    });

    return engineRef.current;
  }, [bpm, beatsPerMeasure, scheduleBeatPulse, volume]);

  useEffect(() => {
    if (!engineRef.current || !isPlaying) {
      return;
    }

    engineRef.current.setBpm(bpm);
    engineRef.current.setBeatsPerMeasure(beatsPerMeasure);
    engineRef.current.setVolume(volume);
  }, [bpm, beatsPerMeasure, volume, isPlaying]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    clearBeatPulseTimeouts();
    setBeatPulse(0);
    setDownbeatPulse(false);
    setIsPlaying(false);
  }, [clearBeatPulseTimeouts]);

  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
      }
      engineRef.current?.stop();
      engineRef.current = null;
      for (const timeoutId of beatPulseTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
      beatPulseTimeoutsRef.current = [];
    };
  }, []);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      stop();
      return;
    }

    const engine = ensureEngine();
    await engine.start();
    setIsPlaying(true);
  }, [ensureEngine, isPlaying, stop]);

  const setBpm = useCallback(
    (nextBpm: number) => {
      const clamped = clampMetronomeBpm(nextBpm);
      setBpmState(clamped);
      persistPreferences({ metronomeBpm: clamped });
    },
    [persistPreferences],
  );

  const setBeatsPerMeasure = useCallback(
    (nextBeats: MetronomeBeatsPerMeasure) => {
      setBeatsPerMeasureState(nextBeats);
      persistPreferences({ metronomeBeatsPerMeasure: nextBeats });
    },
    [persistPreferences],
  );

  const setVolume = useCallback(
    (nextVolume: number) => {
      const clamped = Math.min(1, Math.max(0, nextVolume));
      setVolumeState(clamped);
      persistPreferences({ metronomeVolume: clamped });
    },
    [persistPreferences],
  );

  const registerTap = useCallback(() => {
    const result = registerTapTempo(tapTimestampsRef.current, Date.now());
    tapTimestampsRef.current = result.taps;

    if (result.bpm !== null) {
      setBpm(result.bpm);
    }
  }, [setBpm]);

  return {
    isPlaying,
    beatPulse,
    downbeatPulse,
    bpm,
    beatsPerMeasure,
    volume,
    minBpm: METRONOME_MIN_BPM,
    maxBpm: METRONOME_MAX_BPM,
    togglePlay,
    stop,
    setBpm,
    setBeatsPerMeasure,
    setVolume,
    registerTap,
  };
}
