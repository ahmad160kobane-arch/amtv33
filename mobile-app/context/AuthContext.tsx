import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  UserProfile,
  isLoggedIn as apiIsLoggedIn,
  fetchProfile,
  logout as apiLogout,
  getSavedUser,
  fetchSubscription,
  SubscriptionInfo,
} from "@/constants/Api";

interface AuthCtx {
  user: UserProfile | null;
  loading: boolean;
  isPremium: boolean;
  isLoggedIn: boolean;
  subscription: SubscriptionInfo | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  isPremium: false,
  isLoggedIn: false,
  subscription: null,
  refresh: async () => {},
  logout: async () => {},
});

function checkIsPremium(
  user: UserProfile | null,
  sub: SubscriptionInfo | null
): boolean {
  // Check subscription info first
  if (sub?.isPremium) return true;
  // Check user role
  if (!user) return false;
  if (user.is_admin || user.role === "admin" || user.role === "agent")
    return true;
  if (user.plan !== "premium") return false;
  if (user.expires_at && new Date(user.expires_at) < new Date()) return false;
  return true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      // Try to fetch profile directly — if token exists it will work
      const [profile, subInfo] = await Promise.all([
        fetchProfile(),
        fetchSubscription(),
      ]);

      if (profile) {
        setUser(profile);
        setSubscription(subInfo);
      } else {
        // No valid session — try saved user as fallback
        const logged = await apiIsLoggedIn();
        if (!logged) {
          setUser(null);
          setSubscription(null);
        } else {
          const saved = await getSavedUser();
          setUser(saved);
          setSubscription(subInfo);
        }
      }
    } catch {
      // On error, try saved user
      try {
        const saved = await getSavedUser();
        if (saved) {
          setUser(saved);
        } else {
          setUser(null);
          setSubscription(null);
        }
      } catch {
        setUser(null);
        setSubscription(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {}
    setUser(null);
    setSubscription(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ─── Periodic session heartbeat (every 60s) ──────────────────
  useEffect(() => {
    if (!user) return;
    let failCount = 0;
    const interval = setInterval(async () => {
      try {
        const profile = await fetchProfile();
        if (!profile) {
          // فشل متتالي — فقط اذا تجاوز 3 مرات نطرد المستخدم
          failCount++;
          if (failCount >= 3) {
            setUser(null);
            setSubscription(null);
          }
        } else {
          failCount = 0;
          setUser(profile);
        }
      } catch {
        // خطأ شبكة — لا نطرد المستخدم الا بعد فشل متتالي
        failCount++;
        if (failCount >= 3) {
          // نحتفظ بالبيانات المحفوظة
          const saved = await getSavedUser();
          if (!saved) {
            setUser(null);
            setSubscription(null);
          }
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const isPremium = checkIsPremium(user, subscription);
  const loggedIn = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isPremium,
        isLoggedIn: loggedIn,
        subscription,
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
