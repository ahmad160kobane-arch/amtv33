"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  UserProfile,
  isLoggedIn,
  fetchProfile,
  logout as apiLogout,
  getSavedUser,
} from "@/constants/api";

interface AuthCtx {
  user: UserProfile | null;
  loading: boolean;
  isPremium: boolean;
  isLoggedIn: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  isPremium: false,
  isLoggedIn: false,
  refresh: async () => {},
  logout: async () => {},
});

function checkIsPremium(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.is_admin || user.role === "admin" || user.role === "agent")
    return true;
  if (user.plan !== "premium") return false;
  if (user.expires_at && new Date(user.expires_at) < new Date()) return false;
  return true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const logged = await isLoggedIn();
      if (!logged) {
        setUser(null);
        setLoading(false);
        return;
      }
      const profile = await fetchProfile();
      if (profile) {
        setUser(profile);
        setLoading(false);
        return;
      }
      const saved = await getSavedUser();
      setUser(saved);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ─── Listen for session invalidation (another device logged in) ────────
  // apiFetch dispatches this event when it receives SESSION_INVALIDATED (401)
  useEffect(() => {
    const onSessionInvalidated = () => {
      setUser(null);
      // Stop any playing stream
      window.dispatchEvent(new CustomEvent('stream:stop'));
    };
    window.addEventListener('auth:session_invalidated', onSessionInvalidated);
    return () => {
      window.removeEventListener('auth:session_invalidated', onSessionInvalidated);
    };
  }, []);

  // ─── Periodic session heartbeat (every 10s) ──────────────────────────
  // Detects login_version mismatch ASAP so the user is kicked out in real-time
  // when someone else logs in on a different device.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const profile = await fetchProfile();
        if (!profile) {
          // Session no longer valid — kick out immediately
          setUser(null);
          window.dispatchEvent(new CustomEvent('auth:session_invalidated'));
          window.dispatchEvent(new CustomEvent('stream:stop'));
        }
      } catch {
        // Network error — don't kick out on transient failures
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const isPremium = checkIsPremium(user);
  const loggedIn = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isPremium,
        isLoggedIn: loggedIn,
        refresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
