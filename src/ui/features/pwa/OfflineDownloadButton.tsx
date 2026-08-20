import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { OfflineFileStatus } from '@/application/offline/types';

import { useOffline } from '@/ui/app/AppServicesContext';

import { ConfirmModal } from '@/ui/components/ConfirmModal';

import { IconCheck, IconOffline } from '@/ui/components/icons';

import { formatBytes, shouldWarnDownloadSize } from '@/ui/features/repertoire/pdf-load';

import { offlineErrorMessage } from '@/ui/features/pwa/offline-error-labels';

import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

type OfflineDownloadButtonProps = {
  organizationId: string;
  pieceId: string;
  fileId: string;
  className?: string;
  allowRemove?: boolean;
  compact?: boolean;
};

type OfflinePlaylistDownloadButtonProps = {
  organizationId: string;
  playlistId: string;
  userId: string;
  pieceFileIds: string[];
  className?: string;
};

type ButtonState = 'idle' | 'downloading' | 'cached' | 'stale' | 'error' | 'offline';

type SizeConfirmState = {
  title: string;
  message: string;
};

function pieceFileIdsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function downloadButtonClassName(state: ButtonState): string {
  const base =
    'inline-flex items-center gap-1 rounded-lg border p-2 text-sm transition-colors disabled:opacity-50';

  switch (state) {
    case 'cached':
      return `${base} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-600/40 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50`;
    case 'stale':
      return `${base} border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-600/40 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50`;
    case 'error':
      return `${base} border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-600/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50`;
    case 'offline':
      return `${base} border-border text-muted hover:bg-bg`;
    default:
      return `${base} border-border text-text hover:bg-bg`;
  }
}

function DownloadButtonIcon({ state }: { state: ButtonState }): ReactNode {
  if (state === 'cached') {
    return <IconCheck className="h-4 w-4 shrink-0" aria-hidden />;
  }

  return <IconOffline className="h-4 w-4 shrink-0" aria-hidden />;
}

function statusLabel(
  state: ButtonState,
  progress?: { done: number; total: number },
  variant: 'file' | 'playlist' = 'file',
): string {
  switch (state) {
    case 'downloading':
      if (variant === 'playlist') {
        return progress ? `Salvando ${progress.done}/${progress.total}` : 'Salvando…';
      }
      return progress ? `Baixando ${progress.done}/${progress.total}` : 'Baixando…';
    case 'cached':
      return 'Disponível offline';
    case 'stale':
      return variant === 'playlist' ? 'Atualizando…' : 'Atualizar download';
    case 'error':
      return variant === 'playlist' ? 'Erro ao salvar' : 'Erro ao baixar';
    case 'offline':
      return 'Sem conexão';
    default:
      return variant === 'playlist' ? 'Salvar no dispositivo' : 'Manter no dispositivo';
  }
}

function shortStatusLabel(state: ButtonState, variant: 'file' | 'playlist' = 'file'): string {
  switch (state) {
    case 'downloading':
      return variant === 'playlist' ? 'Salvando…' : 'Baixando…';
    case 'cached':
      return 'Salvo';
    case 'stale':
      return variant === 'playlist' ? 'Atualizando' : 'Atualizar';
    case 'error':
      return 'Erro';
    case 'offline':
      return 'Offline';
    default:
      return 'Offline';
  }
}

export function OfflineDownloadButton({
  organizationId,
  pieceId,
  fileId,
  className,
  allowRemove = true,
  compact = false,
}: OfflineDownloadButtonProps) {
  const offline = useOffline();
  const online = useOnlineStatus();
  const [state, setState] = useState<ButtonState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sizeConfirm, setSizeConfirm] = useState<SizeConfirmState | null>(null);

  const refreshStatus = useCallback(async () => {
    const result = await offline.getOfflineStatus(organizationId, pieceId, fileId);

    if (!result.ok) {
      setState('idle');
      return;
    }

    if (result.value.fileStatus === 'cached') {
      setState('cached');
    } else if (result.value.fileStatus === 'stale') {
      setState('stale');
    } else {
      setState('idle');
    }
  }, [offline, organizationId, pieceId, fileId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function runDownload() {
    setState('downloading');
    setErrorMessage(null);

    const result = await offline.cachePieceFileForOffline(organizationId, pieceId, fileId);

    if (!result.ok) {
      setState('error');
      setErrorMessage(offlineErrorMessage(result.error));
      return;
    }

    await refreshStatus();
  }

  async function handleDownload() {
    if (!online) {
      setState('offline');
      setErrorMessage(offlineErrorMessage('offline'));
      return;
    }

    if (state === 'cached') {
      if (!allowRemove) {
        return;
      }
      await offline.removeCachedPieceFile(fileId);
      setState('idle');
      setErrorMessage(null);
      return;
    }

    const fileMeta = await offline.estimatePlaylistCacheSize(organizationId, [fileId]);
    if (shouldWarnDownloadSize(fileMeta)) {
      setSizeConfirm({
        title: 'Arquivo grande',
        message: `Este arquivo tem ${formatBytes(fileMeta)}. Deseja salvar no dispositivo para leitura offline?`,
      });
      return;
    }

    await runDownload();
  }

  const label = statusLabel(state);
  const disabled =
    state === 'downloading' ||
    (!online && state !== 'cached') ||
    (state === 'cached' && !allowRemove);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={disabled}
        title={errorMessage ?? label}
        aria-label={errorMessage ?? label}
        className={downloadButtonClassName(state)}
      >
        <DownloadButtonIcon state={state} />
        {!compact && <span className="hidden sm:inline">{label}</span>}
      </button>
      {!compact && errorMessage && <p className="mt-1 text-xs text-red-600">{errorMessage}</p>}

      <ConfirmModal
        open={sizeConfirm != null}
        title={sizeConfirm?.title ?? ''}
        message={sizeConfirm?.message ?? ''}
        confirmLabel="Baixar"
        onClose={() => setSizeConfirm(null)}
        onConfirm={() => {
          setSizeConfirm(null);
          void runDownload();
        }}
        isConfirming={state === 'downloading'}
      />
    </div>
  );
}

export function OfflinePlaylistDownloadButton({
  organizationId,
  playlistId,
  userId,
  pieceFileIds,
  className,
}: OfflinePlaylistDownloadButtonProps) {
  const offline = useOffline();
  const online = useOnlineStatus();
  const [state, setState] = useState<ButtonState>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoCacheKeyRef = useRef<string | null>(null);
  const pieceFileIdsKey = pieceFileIds.join(',');

  const refreshStatus = useCallback(async () => {
    const cached = await offline.getCachedReadingPlaylist(playlistId);
    if (!cached) {
      setState('idle');
      return 'idle' as const;
    }

    const cachedPieceFileIds = cached.items
      .filter((item) => Boolean(item.pieceId) && !item.pieceDeleted)
      .map((item) => item.pieceFileId);

    const currentPieceFileIds = pieceFileIdsKey.length > 0 ? pieceFileIdsKey.split(',') : [];
    if (!pieceFileIdsEqual(cachedPieceFileIds, currentPieceFileIds)) {
      setState('stale');
      return 'stale' as const;
    }

    setState('cached');
    return 'cached' as const;
  }, [offline, playlistId, pieceFileIdsKey]);

  const runDownload = useCallback(async () => {
    const total = pieceFileIdsKey.length > 0 ? pieceFileIdsKey.split(',').length : 0;
    setState('downloading');
    setProgress({ done: 0, total });
    setErrorMessage(null);

    const result = await offline.cacheReadingPlaylistForOffline(
      organizationId,
      playlistId,
      userId,
      (next) => setProgress({ done: next.done, total: next.total }),
    );

    if (!result.ok) {
      setState('error');
      setErrorMessage(offlineErrorMessage(result.error));
      setProgress(null);
      return;
    }

    if (result.value.errors.length > 0) {
      setErrorMessage(
        `Alguns arquivos não foram salvos: ${result.value.errors.map(offlineErrorMessage).join(' ')}`,
      );
    }

    setProgress(null);
    await refreshStatus();
  }, [offline, organizationId, playlistId, userId, pieceFileIdsKey, refreshStatus]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!online || pieceFileIdsKey.length === 0) {
      return;
    }

    const cacheKey = `${playlistId}:${pieceFileIdsKey}`;
    if (autoCacheKeyRef.current === cacheKey) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const nextState = await refreshStatus();
        if (cancelled || nextState === 'cached') {
          if (nextState === 'cached') {
            autoCacheKeyRef.current = cacheKey;
          }
          return;
        }
        autoCacheKeyRef.current = cacheKey;
        await runDownload();
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [online, playlistId, pieceFileIdsKey, refreshStatus, runDownload]);

  async function handleDownload() {
    if (!online) {
      setState('offline');
      setErrorMessage(offlineErrorMessage('offline'));
      return;
    }

    if (pieceFileIds.length === 0 || state === 'downloading' || state === 'cached') {
      return;
    }

    await runDownload();
  }

  const label = statusLabel(state, progress ?? undefined, 'playlist');
  const disabled = state === 'downloading' || state === 'cached' || !online;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={disabled}
        title={label}
        aria-label={label}
        className={downloadButtonClassName(state)}
      >
        <DownloadButtonIcon state={state} />
        <span className="sm:hidden">{shortStatusLabel(state, 'playlist')}</span>
        <span className="hidden sm:inline">{label}</span>
      </button>
      {errorMessage && <p className="mt-1 text-xs text-red-600">{errorMessage}</p>}
    </div>
  );
}

export function OfflineFileStatusBadge({
  organizationId,
  pieceId,
  fileId,
}: {
  organizationId: string;
  pieceId: string;
  fileId: string;
}) {
  const offline = useOffline();
  const [fileStatus, setFileStatus] = useState<OfflineFileStatus>('not_cached');
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    void offline.getOfflineStatus(organizationId, pieceId, fileId).then((result) => {
      if (result.ok) {
        setFileStatus(result.value.fileStatus);
        setPendingSync(result.value.pendingSyncCount);
      }
    });
  }, [offline, organizationId, pieceId, fileId]);

  if (pendingSync === 0 && fileStatus !== 'stale') {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pt-2 text-xs text-muted">
      {fileStatus === 'stale' && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          Download desatualizado
        </span>
      )}
      {pendingSync > 0 && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
          {pendingSync} pendente(s) de sync
        </span>
      )}
    </div>
  );
}
