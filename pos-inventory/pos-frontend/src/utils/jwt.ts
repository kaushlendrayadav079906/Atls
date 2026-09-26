/**
 * JWT token utilities
 */

import { getCookie, deleteCookie } from './cookies';

interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  user_id: string;
  exp: number;
  branch_id?: string | null;
  store_name?: string | null;
}

/**
 * Decode JWT token (without verification - for client-side expiry check only)
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    void error;
    return null;
  }
}

/**
 * Check if JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }

  // exp is in seconds, Date.now() is in milliseconds
  const currentTime = Date.now() / 1000;
  return payload.exp < currentTime;
}

/**
 * Get token from cookie and check if it's valid
 */
export function getValidToken(): string | null {
  const token = getCookie('pos_token');
  
  if (!token) {
    return null;
  }

  if (isTokenExpired(token)) {
    deleteCookie('pos_token');
    deleteCookie('pos_user');
    return null;
  }

  return token;
}

/**
 * Get time until token expires (in milliseconds)
 */
export function getTokenExpiryTime(token: string): number | null {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return null;
  }

  const currentTime = Date.now();
  const expiryTime = payload.exp * 1000; // Convert to milliseconds
  return expiryTime - currentTime;
}
