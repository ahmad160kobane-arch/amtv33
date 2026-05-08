// ============================================================
// PremiumGuard — كل المحتوى بريميوم فقط
// لا يوجد محتوى مجاني — يجب تسجيل الدخول + اشتراك بريميوم
// ============================================================
import { useAuth } from "@/context/AuthContext";
import { useAppAlert } from "@/components/AppAlert";
import { useRouter } from "expo-router";

interface GuardResult {
  /** هل المستخدم بريميوم ومسجل الدخول؟ */
  allowed: boolean;
  /** هل التحقق لا يزال قيد التحميل؟ */
  loading: boolean;
  /** طلب مشاهدة محتوى — يعرض التنبيهات تلقائياً */
  requireAuth: (action: () => void) => void;
  /** طلب مشاهدة محتوى مع رد نداء عند الرفض */
  requireAuthAsync: (onAllowed: () => void) => boolean;
}

export function usePremiumGuard(): GuardResult {
  const { isPremium, isLoggedIn, loading } = useAuth();
  const alert = useAppAlert();
  const router = useRouter();

  const requireAuth = (action: () => void) => {
    if (loading) return;
    if (!isLoggedIn) {
      alert.show({
        title: "تسجيل الدخول مطلوب",
        message: "سجّل الدخول أولاً لمشاهدة المحتوى",
        buttons: [
          {
            text: "تسجيل الدخول",
            onPress: () => router.push("/(tabs)/account" as any),
          },
          { text: "لاحقاً", style: "cancel" },
        ],
      });
      return;
    }
    if (!isPremium) {
      alert.show({
        title: "محتوى بريميوم 🔒",
        message:
          "هذا المحتوى يتطلب اشتراكاً بريميوم.\nاشترك الآن لمشاهدة جميع الأفلام والمسلسلات والقنوات!",
        buttons: [
          {
            text: "اشترك الآن",
            onPress: () => router.push("/subscription"),
          },
          { text: "لاحقاً", style: "cancel" },
        ],
      });
      return;
    }
    action();
  };

  /** نسخة متزامنة ترجع true إذا سُمح */
  const requireAuthAsync = (onAllowed: () => void): boolean => {
    if (loading) return false;
    if (!isLoggedIn || !isPremium) {
      requireAuth(() => {});
      return false;
    }
    onAllowed();
    return true;
  };

  return {
    allowed: isLoggedIn && isPremium && !loading,
    loading,
    requireAuth,
    requireAuthAsync,
  };
}
