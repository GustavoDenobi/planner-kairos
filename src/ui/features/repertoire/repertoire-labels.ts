import type { PieceFileKind } from '@/domain/repertoire';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import type { PieceFilePartLink } from '@/domain/repertoire';

export function pieceFileKindLabel(kind: PieceFileKind): string {  return kind === 'score' ? 'Partitura' : 'Áudio';
}

export function formatPartLinks(
  links: PieceFilePartLink[],
  parts: PartWithDivisions[],
): string {
  if (links.length === 0) {
    return 'Geral';
  }

  const partById = new Map(parts.map((part) => [part.id, part]));

  const formatLink = (link: PieceFilePartLink): string => {
    const part = partById.get(link.partId);
    if (!part) {
      return 'Parte desconhecida';
    }
    if (!link.partDivisionId) {
      return part.name;
    }
    const division = part.divisions.find((item) => item.id === link.partDivisionId);
    return division ? division.name : part.name;
  };

  const partLinks = links.filter((link) => !link.partDivisionId);
  const divisionLinks = links.filter((link) => link.partDivisionId);

  return [...partLinks, ...divisionLinks].map(formatLink).join(', ');
}

export const REPERTOIRE_ERROR_MESSAGES: Record<string, string> = {
  invalid_title: 'Informe o título da obra antes de salvar.',
  invalid_file_title: 'Informe o título do arquivo antes de salvar.',
  invalid_category: 'Selecione uma categoria para continuar.',
  invalid_name: 'Informe um nome válido antes de salvar.',
  invalid_slug: 'Identificador inválido. Use apenas letras, números e hífens.',
  duplicate_slug: 'Já existe um item com esse identificador. Escolha outro nome.',
  duplicate_title: 'Já existe uma obra com esse título. Escolha um título diferente.',
  category_in_use: 'Esta categoria está em uso. Remova-a das obras antes de excluir.',
  upload_failed: 'Não foi possível enviar o arquivo. Verifique a conexão e tente novamente.',
  duplicate_file: 'Este arquivo já está nesta obra. Escolha outro arquivo ou renomeie o existente.',
  invalid_mime_type: 'Formato não suportado. Envie PDF ou áudio (MP3/WAV).',
  invalid_part_link: 'Seleção de partes inválida. Revise as partes vinculadas ao arquivo.',
  delete_failed: 'Não foi possível remover. Verifique sua conexão e tente novamente.',
  create_failed: 'Não foi possível salvar. Verifique os campos e tente novamente.',
  update_failed: 'Não foi possível atualizar. Verifique os campos e tente novamente.',
  not_found: 'Obra não encontrada. Ela pode ter sido removida — atualize a página.',
  reorder_failed: 'Não foi possível reordenar. Tente novamente em instantes.',
  load_failed: 'Não foi possível carregar o arquivo. Verifique a conexão e tente novamente.',
};

function mapStorageErrorDetail(detail: string): string | null {
  const normalized = detail.toLowerCase();

  if (normalized.includes('failed to fetch') || normalized.includes('networkerror')) {
    return 'Falha de conexão com o servidor. Verifique a internet e tente novamente.';
  }
  if (normalized.includes('row-level security') || normalized.includes('policy')) {
    return 'Sem permissão para enviar arquivos nesta organização.';
  }
  if (normalized.includes('mime type') || normalized.includes('not allowed')) {
    return 'Formato não aceito pelo servidor. Use PDF ou áudio (MP3/WAV).';
  }
  if (normalized.includes('too large') || normalized.includes('payload')) {
    return 'Arquivo muito grande. O limite é 50 MB.';
  }
  if (normalized.includes('already exists')) {
    return 'Este arquivo já foi enviado.';
  }

  return null;
}

export function repertoireErrorMessage(code: string): string {
  if (code.startsWith('upload_failed:')) {
    const detail = code.slice('upload_failed:'.length).trim();
    if (!detail) {
      return REPERTOIRE_ERROR_MESSAGES.upload_failed;
    }
    return mapStorageErrorDetail(detail) ?? `${REPERTOIRE_ERROR_MESSAGES.upload_failed} (${detail})`;
  }

  return REPERTOIRE_ERROR_MESSAGES[code] ?? 'Algo deu errado. Verifique sua conexão e tente novamente.';
}
