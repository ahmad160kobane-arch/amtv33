'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, isLoggedIn, fetchProfile, logout as apiLogout, getSavedUser } from '@/constants/api';

interface AuthCtx {
  user: UserProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true, refresh: async () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const logged = await isLoggedIn();
      if (!logged) { setUser(null); return; }
      const profile = await fetchProfile();
      if (profile) { setUser(profile); return; }
      const saved = await getSavedUser();
      setUser(saved);
    } catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
