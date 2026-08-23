import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconPlay, IconX } from '@/ui/components/icons';

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
  title: string;
  url: string;
  onClose: () => void;
};

export function PdfViewerInlineAudioBar({ title, url, onClose }: PdfViewerInlineAudioBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = volume;
    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  }, [url, volume]);

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

      <p className="min-w-0 flex-1 truncate text-sm font-medium text-text" title={title}>
        {title}
      </p>

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-text"
      >
        {isPlaying ? (
          <span className="text-xs font-bold tracking-tighter" aria-hidden="true">
            ||
          </span>
        ) : (
          <IconPlay className="h-4 w-4" />
        )}
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
        className="min-w-24 flex-[2] accent-primary"
      />

      <span className="shrink-0 tabular-nums text-xs text-muted">
        {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
      </span>

      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
        aria-label="Volume"
        className="w-20 shrink-0 accent-primary"
      />

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
  title: string;
  url: string;
  onClose: () => void;
};

export function renderPdfViewerInlineAudioBar(props: PdfViewerInlineAudioProps): ReactNode {
  return <PdfViewerInlineAudioBar {...props} />;
}
