import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '@/ui/components/PlaceholderPage';

export function InvitePage() {
  const { token } = useParams();

  return (
    <PlaceholderPage
      title="Convite"
      description={`Aceite de convite (token: ${token ?? '—'}) será implementado na Fase 1.`}
    />
  );
}
