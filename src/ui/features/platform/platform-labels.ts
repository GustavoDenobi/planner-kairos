export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatLimit(value: number | null): string {
  return value === null ? 'Ilimitado' : String(value);
}

export function platformErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    forbidden: 'Você não tem permissão para esta ação.',
    not_authenticated: 'Sessão expirada. Faça login novamente.',
    invalid_input: 'Preencha os campos obrigatórios.',
    slug_taken: 'Este identificador (slug) já está em uso.',
    owner_not_found: 'Usuário owner não encontrado.',
    plan_not_found: 'Plano não encontrado.',
    org_not_found: 'Organização não encontrada.',
    user_not_found: 'Usuário não encontrado.',
    membership_not_found: 'Vínculo não encontrado.',
    weak_password: 'A senha deve ter pelo menos 8 caracteres.',
    cannot_delete_self: 'Você não pode excluir sua própria conta.',
    unknown_error: 'Ocorreu um erro inesperado.',
  };

  return messages[error] ?? error;
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function usagePercent(current: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) {
    return null;
  }

  return Math.min(100, Math.round((current / limit) * 100));
}
