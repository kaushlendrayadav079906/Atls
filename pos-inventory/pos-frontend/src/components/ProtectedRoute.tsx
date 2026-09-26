import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { getCookie } from '../utils/cookies';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  
  // Check both Redux state and cookie for authentication
  const hasToken = getCookie('pos_token');
  
  if (!isAuthenticated && !hasToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
