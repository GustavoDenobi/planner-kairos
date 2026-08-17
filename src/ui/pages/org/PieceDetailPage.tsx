import { useParams } from 'react-router-dom';
import { PlaceholderPage } from '@/ui/components/PlaceholderPage';

export function PieceDetailPage() {
  const { pieceId } = useParams();

  return (
    <PlaceholderPage
      title="Ficha da obra"
      description={`Obra ${pieceId ?? '—'} — detalhes serão implementados na Fase 3.`}
    />
  );
}
