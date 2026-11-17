import { useCallback, useEffect, useRef, useState } from 'react';
import { TUNER_ANALYSER_FFT_SIZE } from '@/ui/features/repertoire/tuner-pitch-detection';

export type UseMicrophoneReturn = {
  analyser: AnalyserNode | null;
  error: string | null;
  isListening: boolean;
  start: () => Promise<void>;
  stop: () => void;
};

export function useMicrophone(): UseMicrophoneReturn {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  /** Incrementa a cada start/stop para descartar pedidos de permissão que ficaram para trás. */
  const generationRef = useRef(0);

  const stop = useCallback(() => {
    generationRef.current += 1;
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    streamRef.current = null;
    setAnalyser(null);
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador não permite acesso ao microfone.');
      return;
    }

    generationRef.current += 1;
    const generation = generationRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });

      if (generation !== generationRef.current) {
        // stop() foi chamado enquanto o navegador pedia permissão.
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (generation !== generationRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        void ctx.close();
        return;
      }

      for (const track of streamRef.current?.getTracks() ?? []) {
        track.stop();
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }

      streamRef.current = stream;
      audioContextRef.current = ctx;

      const node = ctx.createAnalyser();
      node.fftSize = TUNER_ANALYSER_FFT_SIZE;
      ctx.createMediaStreamSource(stream).connect(node);

      setError(null);
      setAnalyser(node);
    } catch {
      setError('Permissão do microfone negada.');
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return {
    analyser,
    error,
    isListening: analyser !== null,
    start,
    stop,
  };
}
