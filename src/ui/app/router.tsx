import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthGuard } from '@/ui/app/auth/AuthGuard';
import { AppLayout } from '@/ui/layouts/AppLayout';
import { PublicLayout } from '@/ui/layouts/PublicLayout';
import { InvitePage } from '@/ui/pages/InvitePage';
import { LoginPage } from '@/ui/pages/LoginPage';
import { OrgSelectorPage } from '@/ui/pages/OrgSelectorPage';
import { PasswordRecoveryPage } from '@/ui/pages/PasswordRecoveryPage';
import { AgendaPage } from '@/ui/pages/org/AgendaPage';
import { EventDetailPage } from '@/ui/pages/org/EventDetailPage';
import { GroupDetailPage } from '@/ui/pages/org/GroupDetailPage';
import { GroupsPage } from '@/ui/pages/org/GroupsPage';
import { MusicianDetailPage } from '@/ui/pages/org/MusicianDetailPage';
import { MusiciansPage } from '@/ui/pages/org/MusiciansPage';
import { PartsPage } from '@/ui/pages/org/PartsPage';
import { PieceDetailPage } from '@/ui/pages/org/PieceDetailPage';
import { RepertoirePage } from '@/ui/pages/org/RepertoirePage';

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/login/recuperar-senha', element: <PasswordRecoveryPage /> },
      { path: '/convite/:token', element: <InvitePage /> },
    ],
  },
  {
    element: <AuthGuard />,
    children: [
      { path: '/orgs', element: <OrgSelectorPage /> },
      {
        path: '/:orgSlug',
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="agenda" replace /> },
          { path: 'agenda', element: <AgendaPage /> },
          { path: 'repertorio', element: <RepertoirePage /> },
          { path: 'repertorio/:pieceId', element: <PieceDetailPage /> },
          { path: 'eventos/:eventId', element: <EventDetailPage /> },
          { path: 'musicos', element: <MusiciansPage /> },
          { path: 'musicos/:musicianId', element: <MusicianDetailPage /> },
          { path: 'grupos', element: <GroupsPage /> },
          { path: 'grupos/:groupId', element: <GroupDetailPage /> },
          { path: 'partes', element: <PartsPage /> },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
