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
  invalid_title: 'Informe o título da obra.',
  invalid_file_title: 'Informe o título do arquivo.',
  invalid_category: 'Selecione uma categoria.',
  invalid_name: 'Informe um nome válido.',
  invalid_slug: 'Slug inválido.',
  duplicate_slug: 'Já existe um item com esse identificador.',
  duplicate_title: 'Já existe uma obra com esse título.',
  category_in_use: 'Categoria em uso por obras do catálogo.',
  upload_failed: 'Não foi possível enviar o arquivo.',
  duplicate_file: 'Este arquivo já está nesta obra.',
  invalid_mime_type: 'Formato não suportado. Use PDF ou áudio (MP3/WAV).',
  delete_failed: 'Não foi possível remover.',
  create_failed: 'Não foi possível salvar.',
  update_failed: 'Não foi possível atualizar.',
  not_found: 'Obra não encontrada.',
};

export function repertoireErrorMessage(code: string): string {
  return REPERTOIRE_ERROR_MESSAGES[code] ?? 'Ocorreu um erro. Tente novamente.';
}
