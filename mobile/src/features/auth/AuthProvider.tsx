import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { restoreSession, subscribeSession } from '@/lib/session';
import { loginAccount, logoutAccount, registerAccount } from '@/services/authService';
import type { AuthUser } from '@/types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
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

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      register: async (input) => {
        await registerAccount(input);
      },
      login: async (input) => {
        await loginAccount(input);
      },
      logout: () => logoutAccount(),
    }),
    [status, user],
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
