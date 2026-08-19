import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { OfflineFileStatus } from '@/application/offline/types';
import { useOffline } from '@/ui/app/AppServicesContext';
import { IconCheck, IconOffline } from '@/ui/components/icons';
import { formatBytes, shouldWarnDownloadSize } from '@/ui/features/repertoire/pdf-load';
import { useOnlineStatus } from '@/ui/features/pwa/useOnlineStatus';

type OfflineDownloadButtonProps = {
  organizationId: string;
  pieceId: string;
  fileId: string;
  className?: string;
};

type OfflinePlaylistDownloadButtonProps = {
  organizationId: string;
  playlistId: string;
  userId: string;
  pieceFileIds: string[];
  className?: string;
};

type ButtonState = 'idle' | 'downloading' | 'cached' | 'stale' | 'error' | 'offline';

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

function statusLabel(state: ButtonState, progress?: { done: number; total: number }): string {
  switch (state) {
    case 'downloading':
      return progress ? `Baixando ${progress.done}/${progress.total}` : 'Baixando…';
    case 'cached':
      return 'Disponível offline';
    case 'stale':
      return 'Atualizar download';
    case 'error':
      return 'Erro ao baixar';
    case 'offline':
      return 'Sem conexão';
    default:
      return 'Manter no dispositivo';
  }
}

function shortStatusLabel(state: ButtonState): string {
  switch (state) {
    case 'downloading':
      return 'Baixando…';
    case 'cached':
      return 'Salvo';
    case 'stale':
      return 'Atualizar';
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
}: OfflineDownloadButtonProps) {
  const offline = useOffline();
  const online = useOnlineStatus();
  const [state, setState] = useState<ButtonState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  async function handleDownload() {
    if (!online) {
      setState('offline');
      return;
    }

    if (state === 'cached') {
      await offline.removeCachedPieceFile(fileId);
      setState('idle');
      return;
    }

    setState('downloading');
    setErrorMessage(null);

    const fileMeta = await offline.estimatePlaylistCacheSize(organizationId, [fileId]);
    if (shouldWarnDownloadSize(fileMeta)) {
      const confirmed = window.confirm(
        `Este arquivo é grande (${formatBytes(fileMeta)}). Deseja baixar para o dispositivo?`,
      );
      if (!confirmed) {
        await refreshStatus();
        return;
      }
    }

    const result = await offline.cachePieceFileForOffline(organizationId, pieceId, fileId);
    if (!result.ok) {
      setState('error');
      setErrorMessage(result.error);
      return;
    }

    await refreshStatus();
  }

  const label = statusLabel(state);
  const disabled = state === 'downloading' || (!online && state !== 'cached');

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
        <span className="sm:hidden">{shortStatusLabel(state)}</span>
        <span className="hidden sm:inline">{label}</span>
      </button>
      {errorMessage && <p className="mt-1 text-xs text-red-600">{errorMessage}</p>}
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

  const refreshStatus = useCallback(async () => {
    const cached = await offline.getCachedReadingPlaylist(playlistId);
    if (!cached) {
      setState('idle');
      return;
    }

    const cachedPieceFileIds = cached.items
      .filter((item) => Boolean(item.pieceId) && !item.pieceDeleted)
      .map((item) => item.pieceFileId);

    if (!pieceFileIdsEqual(cachedPieceFileIds, pieceFileIds)) {
      setState('stale');
      return;
    }

    setState('cached');
  }, [offline, playlistId, pieceFileIds]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function handleDownload() {
    if (!online) {
      setState('offline');
      return;
    }

    if (pieceFileIds.length === 0) {
      return;
    }

    setState('downloading');
    setProgress({ done: 0, total: pieceFileIds.length });
    setErrorMessage(null);

    const estimated = await offline.estimatePlaylistCacheSize(organizationId, pieceFileIds);
    if (shouldWarnDownloadSize(estimated)) {
      const confirmed = window.confirm(
        `A playlist tem ~${formatBytes(estimated)} de partituras. Deseja baixar para o dispositivo?`,
      );
      if (!confirmed) {
        await refreshStatus();
        setProgress(null);
        return;
      }
    }

    const result = await offline.cacheReadingPlaylistForOffline(
      organizationId,
      playlistId,
      userId,
      (next) => setProgress({ done: next.done, total: next.total }),
    );

    if (!result.ok) {
      setState('error');
      setErrorMessage(result.error);
      setProgress(null);
      return;
    }

    if (result.value.errors.length > 0) {
      setErrorMessage(result.value.errors.join('; '));
    }

    setProgress(null);
    await refreshStatus();
  }

  const label = statusLabel(state, progress ?? undefined);
  const disabled = state === 'downloading' || (!online && state !== 'cached' && state !== 'stale');

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
        <span className="sm:hidden">{shortStatusLabel(state)}</span>
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
