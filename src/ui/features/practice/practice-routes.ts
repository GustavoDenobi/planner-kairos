import type { PracticeTaskReference } from '@/domain/practice';
import { practiceTaskReferenceStartPage } from '@/domain/practice';
import { piecePdfViewerPath } from '@/ui/features/repertoire/piece-file-routes';

export type PracticeTaskPrefill = {
  groupId?: string;
  musicianId?: string;
  pieceId?: string;
  fileId?: string;
  page?: number;
  eventId?: string;
  /** Público inteiro (atalhos dentro do app, fora da URL). */
  groupIds?: string[];
  musicianIds?: string[];
  /** Prazo sugerido: o primeiro encontro do público depois deste instante (ISO). */
  nextAfter?: string;
};

export function practiceTasksPath(orgSlug: string): string {
  return `/${orgSlug}/tarefas`;
}

/** Formulário de nova tarefa; os atalhos de outras telas preenchem campos pela URL. */
export function practiceTaskNewPath(orgSlug: string, prefill: PracticeTaskPrefill = {}): string {
  const params = new URLSearchParams();
  if (prefill.groupId) params.set('grupo', prefill.groupId);
  if (prefill.musicianId) params.set('musico', prefill.musicianId);
  if (prefill.pieceId) params.set('obra', prefill.pieceId);
  if (prefill.fileId) params.set('arquivo', prefill.fileId);
  if (prefill.page) params.set('pagina', String(prefill.page));
  if (prefill.eventId) params.set('evento', prefill.eventId);
  const query = params.toString();
  return `/${orgSlug}/tarefas/nova${query ? `?${query}` : ''}`;
}

export function readPracticeTaskPrefill(params: URLSearchParams): PracticeTaskPrefill {
  const page = Number(params.get('pagina'));
  return {
    groupId: params.get('grupo') ?? undefined,
    musicianId: params.get('musico') ?? undefined,
    pieceId: params.get('obra') ?? undefined,
    fileId: params.get('arquivo') ?? undefined,
    page: Number.isInteger(page) && page > 0 ? page : undefined,
    eventId: params.get('evento') ?? undefined,
  };
}

export function practiceTaskPath(orgSlug: string, taskId: string): string {
  return `/${orgSlug}/tarefas/${taskId}`;
}

export function practiceTaskEditPath(orgSlug: string, taskId: string): string {
  return `/${orgSlug}/tarefas/${taskId}/editar`;
}

/** Leitor aberto no trecho da tarefa. */
export function practiceReaderPath(
  orgSlug: string,
  taskId: string,
  reference: Extract<PracticeTaskReference, { kind: 'file' }>,
): string {
  const params = new URLSearchParams({ tarefa: taskId });
  const page = practiceTaskReferenceStartPage(reference);
  if (page && page > 1) {
    params.set('pagina', String(page));
  }
  return `${piecePdfViewerPath(orgSlug, reference.pieceId, reference.pieceFileId)}?${params.toString()}`;
}
