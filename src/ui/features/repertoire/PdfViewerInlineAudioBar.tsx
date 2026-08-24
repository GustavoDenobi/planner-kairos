import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { IconPause, IconPlay, IconVolume, IconVolumeMuted, IconX } from '@/ui/components/icons';

function isIosVolumeControlUnsupported(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return true;
  }

  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function subscribeToSmallScreen(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia('(max-width: 639px)');
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getIsSmallScreen(): boolean {
  return window.matchMedia('(max-width: 639px)').matches;
}

function useIsSmallScreen(): boolean {
  return useSyncExternalStore(subscribeToSmallScreen, getIsSmallScreen, () => false);
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

type PdfViewerInlineAudioBarProps = {
  url: string;
  onClose: () => void;
};

export function PdfViewerInlineAudioBar({ url, onClose }: PdfViewerInlineAudioBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const supportsVolumeControl = useMemo(() => !isIosVolumeControlUnsupported(), []);
  const isSmallScreen = useIsSmallScreen();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (supportsVolumeControl) {
      if (isSmallScreen) {
        audio.muted = isMuted;
      } else {
        audio.muted = false;
        audio.volume = volume;
      }
    }

    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  }, [url, volume, isMuted, isSmallScreen, supportsVolumeControl]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((previous) => !previous);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-3 py-2">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text"
      >
        {isPlaying ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
      </button>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        onChange={(event) => {
          const nextTime = Number(event.target.value);
          setCurrentTime(nextTime);
          if (audioRef.current) {
            audioRef.current.currentTime = nextTime;
          }
        }}
        aria-label="Posição do áudio"
        className="min-w-0 flex-1 accent-primary"
      />

      <span className="shrink-0 tabular-nums text-xs text-muted">
        {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
      </span>

      {supportsVolumeControl ? (
        <>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Ativar som' : 'Silenciar áudio'}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text sm:hidden"
          >
            {isMuted ? <IconVolumeMuted className="h-4 w-4" /> : <IconVolume className="h-4 w-4" />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
            className="hidden w-20 shrink-0 accent-primary sm:block"
          />
        </>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar áudio"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:text-text"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}

export type PdfViewerAudioPickerProps = {
  visible: boolean;
  onOpenPicker: () => void;
};

export type PdfViewerInlineAudioProps = {
  url: string;
  onClose: () => void;
};

export function renderPdfViewerInlineAudioBar(props: PdfViewerInlineAudioProps): ReactNode {
  return <PdfViewerInlineAudioBar {...props} />;
}
