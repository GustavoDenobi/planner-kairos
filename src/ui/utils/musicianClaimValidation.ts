import type { InviteSignupField, InviteSignupFieldErrorCode } from '@/domain/identity';

export function musicianClaimFieldErrorMessage(
  field: InviteSignupField,
  code: InviteSignupFieldErrorCode,
): string {
  switch (field) {
    case 'displayName':
      return code === 'required' ? 'Informe seu nome.' : 'Nome inválido.';
    case 'email':
      if (code === 'required') return 'Informe seu e-mail.';
      return 'E-mail inválido.';
    case 'phone':
      if (code === 'required') return 'Informe seu telefone.';
      return 'Telefone inválido. Use DDD + número (10 ou 11 dígitos).';
    case 'birthDate':
      if (code === 'required') return 'Informe sua data de nascimento.';
      return 'Data de nascimento inválida.';
    case 'password':
      if (code === 'required') return 'Informe sua senha.';
      return 'A senha deve ter pelo menos 6 caracteres.';
  }
}

export function musicianClaimSubmitErrorMessage(error: string): string {
  if (error === 'email_taken') {
    return 'Este e-mail já possui uma conta. Faça login para vincular seu cadastro.';
  }

  if (error === 'signup_failed') {
    return 'Não foi possível criar a conta. Verifique o e-mail ou tente novamente.';
  }

  if (error.includes('already_claimed')) {
    return 'Este cadastro já foi vinculado a uma conta.';
  }

  if (error.includes('not_found')) {
    return 'Cadastro de músico não encontrado.';
  }

  if (error.includes('musician_exists') || error.includes('already_member')) {
    return 'Suas atribuições do maestro foram unidas ao seu perfil.';
  }

  return 'Não foi possível vincular sua conta. Verifique os dados e tente novamente.';
}

export function assignmentPreviewLabel(input: {
  groupName: string;
  sectionName: string | null;
  partName: string | null;
  ensembleRoleLabel: string;
}): string {
  const parts = [
    input.groupName,
    input.sectionName,
    input.partName,
    input.ensembleRoleLabel,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));

  return parts.join(' · ');
}
