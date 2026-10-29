import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from '../components/ui.jsx';

export function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return children;
}

export function RequireStaff({ children, perm }) {
  const { user, ready, can } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (user.role !== 'staff') return <Navigate to="/account" replace />;
  if (perm && !can(perm)) {
    return <div className="empty m-8"><p className="text-lg font-bold">No access</p><p className="muted">Your account does not have access to this module. Ask the owner to update your permissions.</p></div>;
  }
  return children;
}
