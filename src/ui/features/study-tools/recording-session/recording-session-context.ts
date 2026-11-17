import { createContext, useContext, useEffect } from 'react';
import type { StudyRecordingRecord } from '@/infrastructure/pwa/db';

export type StudyRecordingSessionStatus = 'idle' | 'starting' | 'recording' | 'paused' | 'saving';

export type StartStudyRecordingOptions = {
  organizationId: string;
  userId: string;
  /** Prefixo do título (ex.: nome da obra). Sem prefixo usa "Gravação <data>". */
  titlePrefix?: string | null;
  pieceId?: string | null;
  pieceFileId?: string | null;
  startPage?: number | null;
  /** Gravação feita dentro de uma tarefa (a única que pode ser enviada a ela). */
  practiceTask?: { id: string; title: string } | null;
};

export type StudyRecordingSessionContextValue = {
  organizationId: string | null;
  userId: string | null;
  pieceId: string | null;
  pieceFileId: string | null;
  practiceTaskId: string | null;
};

export type StudyRecordingSessionValue = {
  status: StudyRecordingSessionStatus;
  error: string | null;
  supportsPause: boolean;
  /** Há uma sessão ocupando o microfone (inclui o pedido de permissão e o salvamento). */
  isMicrophoneClaimed: boolean;
  isSessionActive: boolean;
  session: StudyRecordingSessionContextValue | null;
  /** Muda sempre que a lista de gravações locais muda (salvar, excluir, recuperar). */
  recordingsVersion: number;
  start: (options: StartStudyRecordingOptions) => Promise<void>;
  stop: () => Promise<StudyRecordingRecord | null>;
  cancel: () => void;
  togglePause: () => void;
  /** Registra a página exibida no leitor enquanto grava. */
  notePage: (pieceFileId: string, page: number) => void;
  notifyRecordingsChanged: () => void;
  clearError: () => void;
  /**
   * Telas que mostram os controles da gravação se registram aqui para
   * esconder o indicador flutuante global.
   */
  registerControlsSurface: () => () => void;
};


export const StudyRecordingSessionContext = createContext<StudyRecordingSessionValue | null>(null);
export const StudyRecordingElapsedContext = createContext<number>(0);

export function useStudyRecordingSession(): StudyRecordingSessionValue {
  const value = useContext(StudyRecordingSessionContext);
  if (!value) {
    throw new Error('useStudyRecordingSession must be used within StudyRecordingSessionProvider');
  }
  return value;
}

/** Tempo gravado (atualiza várias vezes por segundo; use só em componentes pequenos). */
export function useStudyRecordingElapsedMs(): number {
  return useContext(StudyRecordingElapsedContext);
}

/** Marca o componente como uma superfície com controles da gravação visíveis. */
export function useStudyRecordingControlsSurface(active = true): void {
  const { registerControlsSurface } = useStudyRecordingSession();
  useEffect(() => {
    if (!active) {
      return;
    }
    return registerControlsSurface();
  }, [active, registerControlsSurface]);
}
