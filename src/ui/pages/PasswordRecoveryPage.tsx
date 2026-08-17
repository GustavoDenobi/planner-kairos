import { Link } from 'react-router-dom';
import { PlaceholderPage } from '@/ui/components/PlaceholderPage';

export function PasswordRecoveryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PlaceholderPage
        title="Recuperar senha"
        description="Fluxo de recuperação por OTP será implementado na Fase 1."
      />
      <Link to="/login" className="text-center text-sm text-primary hover:underline">
        Voltar para o login
      </Link>
    </div>
  );
}
