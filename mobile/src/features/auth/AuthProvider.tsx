import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { USERS_ME_PATH } from '@/constants/api';
import { apiRequest } from '@/lib/apiClient';
import { profileCache } from '@/lib/cache/profileCache';
import { applyUserUpdate, restoreSession, subscribeSession } from '@/lib/session';
import { loginAccount, logoutAccount, registerAccount } from '@/services/authService';
import type { AuthUser } from '@/types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  register: (input: { name: string; username: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: (options?: { force?: boolean }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeSession((next) => {
      if (!active) {
        return;
      }
      setUser(next);
      setStatus(next ? 'authenticated' : 'anonymous');
    });

    void restoreSession().then((next) => {
      if (!active) {
        return;
      }
      setUser(next);
      setStatus(next ? 'authenticated' : 'anonymous');
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const register = useCallback(
    async (input: { name: string; username: string; email: string; password: string }) => {
      await registerAccount(input);
    },
    [],
  );

  const login = useCallback(async (input: { email: string; password: string }) => {
    await loginAccount(input);
  }, []);

  const logout = useCallback(() => logoutAccount(), []);

  const refreshProfile = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force && profileCache.isFresh()) {
      return;
    }
    const next = await apiRequest<AuthUser>(USERS_ME_PATH);
    profileCache.markFetched();
    await applyUserUpdate(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      register,
      login,
      logout,
      refreshProfile,
    }),
    [status, user, register, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return value;
}
