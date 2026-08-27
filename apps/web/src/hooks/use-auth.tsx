'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, keepSessionAlive, onSessionLost } from '@/lib/api';
import { can, type Permission, type Role } from '@taller/shared';

export interface AuthUser {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  avatarUrl?: string | null;
  tenant?: { id: string; slug: string; name: string; logoUrl?: string | null } | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const enLogin = useRef(false);
  enLogin.current = pathname === '/login';

  useEffect(() => {
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  /**
   * El access token dura 15 minutos. En vez de esperar a que venza y que la
   * pantalla se coma un 401, se renueva sola cada 12: al volver a la pestaña,
   * al recuperar la red y por reloj. Así el usuario nunca ve la falla.
   */
  useEffect(() => {
    if (!user) return;
    const renovar = () => { void keepSessionAlive(); };
    const reloj = setInterval(renovar, 12 * 60 * 1000);
    const alVolver = () => { if (!document.hidden) renovar(); };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', renovar);
    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', renovar);
    };
  }, [user]);

  /** Si el refresh tampoco sirvió, la sesión se terminó: al login, sin vueltas. */
  useEffect(() => onSessionLost(() => {
    setUser(null);
    if (!enLogin.current) router.replace('/login');
  }), [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.post<{ user: AuthUser }>('/auth/login', { email, password });
      setUser(r.user);
      router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo<AuthCtx>(
    () => ({ user, loading, login, logout, can: (p) => (user ? can(user.role, p) : false) }),
    [user, loading, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
