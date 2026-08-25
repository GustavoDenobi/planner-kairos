import { Link } from 'react-router-dom';

export function PublicPrivacyFooter() {
  return (
    <footer
      className="shrink-0 py-4 text-center text-sm text-muted"
      style={{
        paddingBottom: 'max(1rem, var(--safe-area-bottom))',
      }}
    >
      <Link to="/privacidade" className="text-primary hover:underline">
        Política de Privacidade
      </Link>
    </footer>
  );
}
