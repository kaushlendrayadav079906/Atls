import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { getCookie } from '../utils/cookies';
import { decodeJWT } from '../utils/jwt';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const token = getCookie('pos_token');

  // Check auth
  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />;
  }

  // Determine role: prefer Redux state, fallback to JWT decode
  let role = user?.role;
  if (!role && token) {
    const payload = decodeJWT(token);
    role = payload?.role;
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
