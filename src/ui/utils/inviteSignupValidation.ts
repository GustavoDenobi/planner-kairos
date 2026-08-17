import type { InviteSignupField, InviteSignupFieldErrorCode } from '@/domain/identity';

export function inviteSignupFieldErrorMessage(
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

export function inviteSignupSubmitErrorMessage(error: string): string {
  if (error === 'signup_failed') {
    return 'Não foi possível criar a conta. Verifique o e-mail ou tente novamente.';
  }

  return 'Não foi possível criar a conta. Verifique os dados ou se o convite ainda é válido.';
}
