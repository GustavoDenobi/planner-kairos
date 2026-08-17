import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '@/ui/components/PlaceholderPage';

export function EventDetailPage() {
  const { eventId } = useParams();

  return (
    <PlaceholderPage
      title="Evento"
      description={`Evento ${eventId ?? '—'} — detalhes serão implementados na Fase 4.`}
    />
  );
}
