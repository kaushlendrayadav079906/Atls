/**
 * Hook to monitor token expiration and auto-logout
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { logoutUser } from '../services/api';
import { getCookie } from '../utils/cookies';
import { getTokenExpiryTime } from '../utils/jwt';

export function useTokenExpiration() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Check token expiration every minute
    const checkInterval = setInterval(() => {
      const token = getCookie('pos_token');
      
      if (!token) {
        logoutUser().catch(() => undefined);
        dispatch(logout());
        queryClient.clear();
        localStorage.removeItem('pos:operator-dashboard:v1');
        navigate('/login');
        return;
      }

      const timeUntilExpiry = getTokenExpiryTime(token);
      
      if (timeUntilExpiry === null || timeUntilExpiry <= 0) {
        logoutUser().catch(() => undefined);
        dispatch(logout());
        queryClient.clear();
        localStorage.removeItem('pos:operator-dashboard:v1');
        navigate('/login');
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [isAuthenticated, dispatch, navigate, queryClient]);
}
