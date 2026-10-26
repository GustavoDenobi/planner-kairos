import { useCallback, useEffect, useRef, useState } from 'react';

const ANALYSER_FFT_SIZE = 4096;

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

  const stop = useCallback(() => {
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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });

      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
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
      node.fftSize = ANALYSER_FFT_SIZE;
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
