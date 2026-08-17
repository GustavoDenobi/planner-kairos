import { Navigate, Outlet } from 'react-router-dom';

// Fase 1: replace with real session check
const isAuthenticated = false;

export function AuthGuard() {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
