import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIdentity } from '@/ui/app/AppServicesContext';
import { useOrg } from '@/ui/app/OrgProvider';

export function AuthCallbackPage() {
  const identity = useIdentity();
  const { setCurrentOrgBySlug } = useOrg();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Entrando…');

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      const session = await identity.getSession();
      if (!active) {
        return;
      }

      if (!session) {
        navigate('/login?error=oauth_failed', { replace: true });
        return;
      }

      const pending = identity.readOAuthPendingContext();
      identity.clearOAuthPendingContext();

      if (!pending) {
        navigate('/orgs', { replace: true });
        return;
      }

      const result = await identity.resumeOAuthPendingAction(pending, session.user.id);
      if (!active) {
        return;
      }

      if (!result.ok) {
        const separator = result.redirectTo.includes('?') ? '&' : '?';
        navigate(`${result.redirectTo}${separator}error=oauth_resume_failed`, { replace: true });
        return;
      }

      const orgMatch = result.redirectTo.match(/^\/([^/]+)\//);
      if (orgMatch) {
        await setCurrentOrgBySlug(orgMatch[1]);
      }

      navigate(result.redirectTo, { replace: true });
    }

    void handleCallback().catch(() => {
      if (active) {
        setMessage('Não foi possível concluir o login.');
        navigate('/login?error=oauth_failed', { replace: true });
      }
    });

    return () => {
      active = false;
    };
  }, [identity, navigate, setCurrentOrgBySlug]);

  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
