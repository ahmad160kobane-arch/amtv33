import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PersonIcon, MailIcon, LockIcon, ShieldIcon, BookmarkIcon,
  DiamondIcon, ClockIcon, SettingsIcon, ChatIcon, ChevronIcon, LogoutIcon,
  StarIcon, LiveIcon, InfoIcon,
} from '@/components/AppIcons';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import AppLogo from '@/components/AppLogo';
import { useAppAlert } from '@/components/AppAlert';
import {
  login,
  register,
  logout,
  fetchProfile,
  getSavedUser,
  isLoggedIn,
  UserProfile,
} from '@/constants/Api';

type IconKey = 'shield' | 'bookmark' | 'diamond' | 'clock' | 'settings' | 'shieldCheck' | 'chat';

function renderMenuIcon(key: IconKey, size: number, color: string) {
  switch (key) {
    case 'shield': return <ShieldIcon size={size} color={color} />;
    case 'bookmark': return <BookmarkIcon size={size} color={color} />;
    case 'diamond': return <DiamondIcon size={size} color={color} />;
    case 'clock': return <ClockIcon size={size} color={color} />;
    case 'settings': return <SettingsIcon size={size} color={color} />;
    case 'shieldCheck': return <ShieldIcon size={size} color={color} />;
    case 'chat': return <ChatIcon size={size} color={color} />;
    default: return <InfoIcon size={size} color={color} />;
  }
}

interface MenuItem {
  icon: IconKey;
  label: string;
  subtitle?: string;
  onPress: () => void;
}

export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { show: showAlert } = useAppAlert();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  // Form fields
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  const loadUser = useCallback(async () => {
    try {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        const profile = await fetchProfile();
        if (profile) { setUser(profile); return; }
        const saved = await getSavedUser();
        if (saved) { setUser(saved); return; }
      }
      setUser(null);
    } catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const handleLogin = async () => {
    if (!loginField.trim() || !password.trim()) { setError('يرجى ملء جميع الحقول'); return; }
    setError(''); setAuthLoading(true);
    try {
      const result = await login(loginField.trim(), password);
      setUser(result.user);
    } catch (e: any) { setError(e.message); }
    finally { setAuthLoading(false); }
  };

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) { setError('يرجى ملء جميع الحقول'); return; }
    setError(''); setAuthLoading(true);
    try {
      const result = await register(username.trim(), email.trim(), password, displayName.trim() || undefined);
      setUser(result.user);
    } catch (e: any) { setError(e.message); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    showAlert({
      title: 'تسجيل الخروج',
      message: 'هل تريد تسجيل الخروج من حسابك؟',
      buttons: [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'خروج', style: 'destructive', onPress: async () => { await logout(); setUser(null); } },
      ],
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Auth Screen (Not Logged In) ────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.authScroll}>
          <View style={styles.authHeader}>
            <AppLogo size="lg" showTagline />
            <Text style={[styles.authTitle, { color: colors.text }]}>
              {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </Text>
            <Text style={[styles.authSub, { color: colors.textSecondary }]}>
              {isLogin ? 'أدخل بياناتك للمتابعة' : 'أنشئ حسابك للاستمتاع بالمحتوى'}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <InfoIcon size={16} color={Colors.brand.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.formCard}>
            {!isLogin && (
              <>
                <View style={[styles.inputWrap, { backgroundColor: colors.inputBackground }]}>
                  <PersonIcon size={18} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="اسم المستخدم"
                    placeholderTextColor={colors.textSecondary}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />
                </View>
                <View style={[styles.inputWrap, { backgroundColor: colors.inputBackground }]}>
                  <MailIcon size={18} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="البريد الإلكتروني"
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={[styles.inputWrap, { backgroundColor: colors.inputBackground }]}>
                  <PersonIcon size={18} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="الاسم الظاهر (اختياري)"
                    placeholderTextColor={colors.textSecondary}
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                </View>
              </>
            )}

            {isLogin && (
              <View style={[styles.inputWrap, { backgroundColor: colors.inputBackground }]}>
                <PersonIcon size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="اسم المستخدم أو البريد"
                  placeholderTextColor={colors.textSecondary}
                  value={loginField}
                  onChangeText={setLoginField}
                  autoCapitalize="none"
                />
              </View>
            )}

            <View style={[styles.inputWrap, { backgroundColor: colors.inputBackground }]}>
              <LockIcon size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="كلمة المرور"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              onPress={isLogin ? handleLogin : handleRegister}
              activeOpacity={0.8}
              disabled={authLoading}
            >
              <LinearGradient colors={Colors.brand.gradient} style={styles.submitBtn}>
                {authLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>{isLogin ? 'دخول' : 'إنشاء حساب'}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => { setIsLogin(!isLogin); setError(''); }}
            style={styles.switchBtn}
          >
            <Text style={[styles.switchText, { color: colors.textSecondary }]}>
              {isLogin ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
              <Text style={{ color: Colors.brand.primary, fontFamily: Colors.fonts.bold }}>
                {isLogin ? ' إنشاء حساب' : ' تسجيل الدخول'}
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Profile Screen (Logged In) ─────────────────────────
  const isAgent = user.role === 'agent' || user.role === 'admin';

  const getPlanLabel = () => {
    if (user.plan !== 'premium') return 'مجاني';
    if (user.expires_at) {
      const d = new Date(user.expires_at);
      const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diff > 0 ? `بريميوم · ${diff} يوم` : 'بريميوم';
    }
    return 'بريميوم';
  };

  const menuItems: MenuItem[] = [
    ...(isAgent ? [{ icon: 'shield' as IconKey, label: 'لوحة الوكيل', subtitle: `الرصيد: $${(user.balance || 0).toFixed(2)}`, onPress: () => router.push('/agent' as any) }] : []),
    { icon: 'bookmark' as IconKey, label: 'قائمتي', subtitle: 'الأفلام والمسلسلات المحفوظة', onPress: () => router.push('/favorites') },
    { icon: 'diamond' as IconKey, label: 'اشتراكي', subtitle: getPlanLabel(), onPress: () => router.push('/subscription') },
    { icon: 'clock' as IconKey, label: 'السجل', subtitle: 'سجل المشاهدة', onPress: () => router.push('/history') },
    { icon: 'settings' as IconKey, label: 'الإعدادات', subtitle: 'تخصيص التطبيق', onPress: () => router.push('/settings') },
    { icon: 'shieldCheck' as IconKey, label: 'الخصوصية', subtitle: 'سياسة الخصوصية', onPress: () => router.push('/privacy') },
    { icon: 'chat' as IconKey, label: 'الدعم', subtitle: 'تواصل معنا', onPress: () => router.push('/support') },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <LinearGradient colors={Colors.brand.gradient} style={styles.avatarWrap}>
            <Text style={styles.avatarLetter}>{(user.display_name || user.username)[0]}</Text>
          </LinearGradient>
          <Text style={[styles.profileName, { color: colors.text }]}>{user.display_name || user.username}</Text>
          <Text style={[styles.profileSub, { color: colors.textSecondary }]}>{user.email}</Text>
          <View style={styles.badgesRow}>
            <View style={[styles.planBadge, { backgroundColor: user.plan === 'free' ? colors.inputBackground : 'rgba(255,184,0,0.15)' }]}>
              {user.plan === 'free' ? <StarIcon size={12} color={Colors.brand.primary} /> : <DiamondIcon size={12} color={Colors.brand.primary} />}
              <Text style={styles.planText}>{user.plan === 'free' ? 'مجاني' : 'بريميوم'}</Text>
            </View>
            {(user.role === 'agent' || user.role === 'admin') && (
              <View style={[styles.roleBadge, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                <ShieldIcon size={12} color="#6366F1" />
                <Text style={[styles.planText, { color: '#6366F1' }]}>
                  {user.role === 'admin' ? 'مشرف' : 'وكيل'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <LiveIcon size={22} color={Colors.brand.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{user.stats?.watched ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>مشاهدة</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <BookmarkIcon size={22} color={Colors.brand.accent} />
            <Text style={[styles.statValue, { color: colors.text }]}>{user.stats?.favorites ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>محفوظ</Text>
          </View>
        </View>

        <View style={[styles.menuCard, { backgroundColor: colors.cardBackground }]}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, index < menuItems.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.divider }]}
              onPress={item.onPress}
              activeOpacity={0.55}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: colors.inputBackground }]}>
                {renderMenuIcon(item.icon, 18, Colors.brand.primary)}
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                {item.subtitle && <Text style={[styles.menuSub, { color: colors.textSecondary }]}>{item.subtitle}</Text>}
              </View>
              <ChevronIcon size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: 'rgba(255,59,48,0.08)' }]} onPress={handleLogout} activeOpacity={0.6}>
          <LogoutIcon size={18} color={Colors.brand.error} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ─── Auth Form ──────────────────
  authScroll: { paddingHorizontal: 24, paddingTop: 40 },
  authHeader: { alignItems: 'center', marginBottom: 28, gap: 12 },
  authTitle: { fontFamily: Colors.fonts.bold, fontSize: 22, marginBottom: 6 },
  authSub: { fontFamily: Colors.fonts.regular, fontSize: 13 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,59,48,0.1)', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, marginBottom: 16,
  },
  errorText: { fontFamily: Colors.fonts.medium, color: Colors.brand.error, fontSize: 13, flex: 1 },
  formCard: { gap: 12, marginBottom: 20 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, paddingHorizontal: 14, height: 50,
  },
  input: { flex: 1, fontFamily: Colors.fonts.regular, fontSize: 14, textAlign: 'right', writingDirection: 'rtl' },
  submitBtn: {
    height: 50, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  submitText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 16 },
  switchBtn: { alignItems: 'center', paddingVertical: 12 },
  switchText: { fontFamily: Colors.fonts.regular, fontSize: 13 },

  // ─── Profile ────────────────────
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 28, paddingBottom: 20,
    gap: 6,
  },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  avatarLetter: { fontFamily: Colors.fonts.extraBold, color: '#fff', fontSize: 32 },
  profileName: { fontFamily: Colors.fonts.bold, fontSize: 20, textAlign: 'center' },
  profileSub: { fontFamily: Colors.fonts.regular, fontSize: 13, textAlign: 'center', marginBottom: 4 },
  badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  planText: { fontFamily: Colors.fonts.medium, fontSize: 11, color: Colors.brand.primary },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', gap: 4 },
  statValue: { fontFamily: Colors.fonts.bold, fontSize: 16 },
  statLabel: { fontFamily: Colors.fonts.regular, fontSize: 10 },
  menuCard: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, paddingHorizontal: 16, gap: 12,
  },
  menuIconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  menuTextWrap: { flex: 1 },
  menuLabel: { fontFamily: Colors.fonts.medium, fontSize: 15 },
  menuSub: { fontFamily: Colors.fonts.regular, fontSize: 11, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 16, borderRadius: 12, paddingVertical: 14,
  },
  logoutText: { fontFamily: Colors.fonts.medium, fontSize: 15, color: Colors.brand.error },
});
