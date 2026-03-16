import { useState } from 'react';
import { signup, login, logout, getCurrentUser, isAuthenticated } from '../api/services/auth';
import type { SignupPayload, LoginPayload, AuthUser, SignupResponse } from '../api/services/auth';

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signup: (payload: SignupPayload) => Promise<SignupResponse>;
  login: (payload: LoginPayload) => Promise<SignupResponse>;
  logout: () => Promise<{ error: string | null }>;
  error: string | null;
}

/**
 * useAuth Hook - Manages authentication state and operations
 *
 * Usage:
 * const { user, isLoading, signup, login, logout, error } = useAuth();
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (payload: SignupPayload): Promise<SignupResponse> => {
    setIsLoading(true);
    setError(null);

    const result = await signup(payload);

    if (result.error) {
      setError(result.error);
      setUser(null);
    } else {
      setUser(result.user);
      // Auto logout after signup (not approved yet)
      setIsAuth(false);
    }

    setIsLoading(false);
    return result;
  };

  const handleLogin = async (payload: LoginPayload): Promise<SignupResponse> => {
    setIsLoading(true);
    setError(null);

    const result = await login(payload);

    if (result.error) {
      setError(result.error);
      setUser(null);
      setIsAuth(false);
    } else {
      setUser(result.user);
      setIsAuth(true);
    }

    setIsLoading(false);
    return result;
  };

  const handleLogout = async (): Promise<{ error: string | null }> => {
    setIsLoading(true);
    setError(null);

    const result = await logout();

    if (result.error) {
      setError(result.error);
    } else {
      setUser(null);
      setIsAuth(false);
    }

    setIsLoading(false);
    return result;
  };

  const handleCheckAuth = async (): Promise<void> => {
    const isAuth = await isAuthenticated();
    if (isAuth) {
      const user = await getCurrentUser();
      setUser(user);
      setIsAuth(true);
    } else {
      setUser(null);
      setIsAuth(false);
    }
  };

  // Initialize auth state on first load (call this in useEffect)
  const initializeAuth = async (): Promise<void> => {
    setIsLoading(true);
    await handleCheckAuth();
    setIsLoading(false);
  };

  return {
    user,
    isLoading,
    isAuthenticated: isAuth,
    signup: handleSignup,
    login: handleLogin,
    logout: handleLogout,
    error,
  };
}

export default useAuth;

