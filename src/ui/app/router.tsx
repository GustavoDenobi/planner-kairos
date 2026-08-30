import { createBrowserRouter, Navigate, Outlet, useNavigation } from 'react-router-dom';
import { AuthGuard } from '@/ui/app/auth/AuthGuard';
import { PlatformAdminGuard } from '@/ui/app/auth/PlatformAdminGuard';import { AdminLayout } from '@/ui/layouts/AdminLayout';
import { PlatformOrganizationDetailPage } from '@/ui/pages/admin/PlatformOrganizationDetailPage';
import { PlatformOrganizationsPage } from '@/ui/pages/admin/PlatformOrganizationsPage';
import { PlatformPlanFormPage } from '@/ui/pages/admin/PlatformPlanFormPage';
import { PlatformPlansPage } from '@/ui/pages/admin/PlatformPlansPage';
import { PlatformUserDetailPage } from '@/ui/pages/admin/PlatformUserDetailPage';
import { PlatformUsersPage } from '@/ui/pages/admin/PlatformUsersPage';
import { HomeRedirect } from '@/ui/app/HomeRedirect';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { AppLayout } from '@/ui/layouts/AppLayout';
import { PublicLayout } from '@/ui/layouts/PublicLayout';
import { InvitePage } from '@/ui/pages/InvitePage';
import { MusicianClaimPage } from '@/ui/pages/MusicianClaimPage';
import { LoginPage } from '@/ui/pages/LoginPage';
import { AuthCallbackPage } from '@/ui/pages/AuthCallbackPage';
import { OrgSelectorPage } from '@/ui/pages/OrgSelectorPage';
import { PasswordRecoveryPage } from '@/ui/pages/PasswordRecoveryPage';
import { PrivacyPolicyPage } from '@/ui/pages/PrivacyPolicyPage';
import { TermsOfUsePage } from '@/ui/pages/TermsOfUsePage';
import { LegalReacceptancePage } from '@/ui/pages/LegalReacceptancePage';
import { AgendaPage } from '@/ui/pages/org/AgendaPage';
import { EventDetailPage } from '@/ui/pages/org/EventDetailPage';
import { GroupDetailPage } from '@/ui/pages/org/GroupDetailPage';
import { GroupsPage } from '@/ui/pages/org/GroupsPage';
import { MusicianDetailPage } from '@/ui/pages/org/MusicianDetailPage';
import { MusiciansPage } from '@/ui/pages/org/MusiciansPage';
import { PartsPage } from '@/ui/pages/org/PartsPage';
import { PieceDetailPage } from '@/ui/pages/org/PieceDetailPage';
import { PiecePdfViewerPage } from '@/ui/pages/org/PiecePdfViewerPage';
import { PrepareReadingPlaylistPage } from '@/ui/pages/org/PrepareReadingPlaylistPage';
import { ReadingPlaylistEditPage } from '@/ui/pages/org/ReadingPlaylistEditPage';
import { ReadingPlaylistNewPage } from '@/ui/pages/org/ReadingPlaylistNewPage';
import { ReadingPlaylistReaderPage } from '@/ui/pages/org/ReadingPlaylistReaderPage';
import { OrganizationSettingsPage } from '@/ui/pages/org/OrganizationSettingsPage';
import { ReadingPlaylistsPage } from '@/ui/pages/org/ReadingPlaylistsPage';
import { RepertoirePage } from '@/ui/pages/org/RepertoirePage';

function RootLayout() {
  const navigation = useNavigation();
  useLoadingBar('navigation', navigation.state === 'loading');
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/auth/callback', element: <AuthCallbackPage /> },
          { path: '/login/recuperar-senha', element: <PasswordRecoveryPage /> },
          { path: '/privacidade', element: <PrivacyPolicyPage /> },
          { path: '/termos', element: <TermsOfUsePage /> },
          { path: '/convite/:token', element: <InvitePage /> },
          { path: '/musico/:musicianId', element: <MusicianClaimPage /> },
        ],
      },
      {
        element: <AuthGuard />,
        children: [
          { path: '/reaceitar-termos', element: <LegalReacceptancePage /> },
          { path: '/orgs', element: <OrgSelectorPage /> },
          {
            path: '/admin',
            element: <PlatformAdminGuard />,
            children: [
              {
                element: <AdminLayout />,
                children: [
                  { index: true, element: <Navigate to="organizacoes" replace /> },
                  { path: 'organizacoes', element: <PlatformOrganizationsPage /> },
                  { path: 'organizacoes/:orgId', element: <PlatformOrganizationDetailPage /> },
                  { path: 'usuarios', element: <PlatformUsersPage /> },
                  { path: 'usuarios/:userId', element: <PlatformUserDetailPage /> },
                  { path: 'planos', element: <PlatformPlansPage /> },
                  { path: 'planos/novo', element: <PlatformPlanFormPage /> },
                  { path: 'planos/:planId', element: <PlatformPlanFormPage /> },
                ],
              },
            ],
          },
          {
            path: '/:orgSlug/repertorio/:pieceId/arquivo/:fileId',
            element: <PiecePdfViewerPage />,
          },
          {
            path: '/:orgSlug/leitura/:playlistId/:itemIndex',
            element: <ReadingPlaylistReaderPage />,
          },
          {
            path: '/:orgSlug',
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to="agenda" replace /> },
              { path: 'agenda', element: <AgendaPage /> },
              { path: 'repertorio', element: <RepertoirePage /> },
              { path: 'repertorio/:pieceId', element: <PieceDetailPage /> },
              { path: 'leitura', element: <ReadingPlaylistsPage /> },
              { path: 'leitura/novo', element: <ReadingPlaylistNewPage /> },
              { path: 'leitura/:playlistId', element: <ReadingPlaylistEditPage /> },
              { path: 'eventos/:eventId/preparar-partituras', element: <PrepareReadingPlaylistPage /> },
              { path: 'eventos/:eventId', element: <EventDetailPage /> },
              { path: 'musicos', element: <MusiciansPage /> },
              { path: 'musicos/:musicianId', element: <MusicianDetailPage /> },
              { path: 'grupos', element: <GroupsPage /> },
              { path: 'grupos/:groupId', element: <GroupDetailPage /> },
              { path: 'partes', element: <PartsPage /> },
              { path: 'configuracao', element: <OrganizationSettingsPage /> },
            ],
          },
        ],
      },
      { path: '/', element: <HomeRedirect /> },
      { path: '*', element: <HomeRedirect /> },
    ],
  },
]);
