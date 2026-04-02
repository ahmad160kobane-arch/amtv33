import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { fetchSubscription, activateCode, isLoggedIn, SubscriptionInfo } from '@/constants/Api';

export default function SubscriptionScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const logged = await isLoggedIn();
    setLoggedIn(logged);
    if (logged) {
      const info = await fetchSubscription();
      setSub(info);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async () => {
    if (!code.trim()) return Alert.alert('خطأ', 'أدخل كود التفعيل');
    setActivating(true);
    try {
      const result = await activateCode(code.trim());
      Alert.alert('تم التفعيل! 🎉', result.message, [{ text: 'حسناً', onPress: load }]);
      setCode('');
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'فشل تفعيل الكود');
    } finally {
      setActivating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>اشتراكي</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.brand.primary} style={{ marginTop: 60 }} />
          ) : !loggedIn ? (
            <View style={styles.center}>
              <Ionicons name="person-outline" size={56} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>سجل الدخول أولاً</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/account' as any)} activeOpacity={0.82}>
                <LinearGradient colors={Colors.brand.gradient} style={styles.loginBtn}>
                  <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* بطاقة حالة الاشتراك */}
              {sub?.isPremium ? (
                <LinearGradient
                  colors={['#6C3DE0', '#9F6FF5']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.premiumCard}
                >
                  <View style={styles.premiumTop}>
                    <View style={styles.crownWrap}>
                      <Ionicons name="diamond" size={28} color="#FFD700" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.premiumLabel}>اشتراك بريميوم</Text>
                      <Text style={styles.premiumSub}>استمتع بجميع المحتوى بدون قيود</Text>
                    </View>
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>نشط</Text>
                    </View>
                  </View>
                  {sub.expires_at && (
                    <View style={styles.expiryRow}>
                      <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.expiryText}>ينتهي: {formatDate(sub.expires_at)}</Text>
                      {sub.daysLeft !== null && (
                        <View style={styles.daysLeftBadge}>
                          <Text style={styles.daysLeftText}>{sub.daysLeft} يوم متبقي</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* مميزات البريميوم */}
                  <View style={styles.featuresGrid}>
                    {[
                      { icon: 'tv-outline', label: 'قنوات HD' },
                      { icon: 'film-outline', label: 'جميع الأفلام' },
                      { icon: 'infinite-outline', label: 'بث غير محدود' },
                      { icon: 'shield-checkmark-outline', label: 'بدون إعلانات' },
                    ].map((f) => (
                      <View key={f.label} style={styles.featureItem}>
                        <Ionicons name={f.icon as any} size={18} color="#FFD700" />
                        <Text style={styles.featureItemText}>{f.label}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.freeCard, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.freeTop}>
                    <View style={[styles.crownWrap, { backgroundColor: 'rgba(150,150,150,0.15)' }]}>
                      <Ionicons name="person-outline" size={26} color={colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.freeLabel, { color: colors.text }]}>اشتراك مجاني</Text>
                      <Text style={[styles.freeSub, { color: colors.textSecondary }]}>محتوى محدود</Text>
                    </View>
                  </View>
                  <View style={[styles.limitedBanner, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                    <Ionicons name="lock-closed-outline" size={16} color="#EF4444" />
                    <Text style={[styles.limitedText, { color: '#EF4444' }]}>
                      القنوات والأفلام والمسلسلات تتطلب اشتراكاً بريميوم
                    </Text>
                  </View>
                </View>
              )}

              {/* حقل تفعيل الكود */}
              <View style={[styles.activateSection, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.activateTitle, { color: colors.text }]}>تفعيل كود الاشتراك</Text>
                <Text style={[styles.activateDesc, { color: colors.textSecondary }]}>
                  أدخل كود التفعيل الذي حصلت عليه من الوكيل
                </Text>
                <View style={[styles.codeInputRow, { backgroundColor: colors.inputBackground }]}>
                  <TextInput
                    style={[styles.codeInput, { color: colors.text }]}
                    placeholder="MA-XXXX-XXXX-XXXX"
                    placeholderTextColor={colors.textSecondary}
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleActivate}
                  />
                  {code.length > 0 && (
                    <TouchableOpacity onPress={() => setCode('')} style={{ padding: 8 }}>
                      <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  onPress={handleActivate}
                  disabled={activating || !code.trim()}
                  activeOpacity={0.82}
                >
                  <LinearGradient colors={Colors.brand.gradient} style={styles.activateBtn}>
                    {activating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="key-outline" size={18} color="#fff" />
                        <Text style={styles.activateBtnText}>تفعيل الكود</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* خطط الاشتراك */}
              <Text style={[styles.plansTitle, { color: colors.text }]}>خطط الاشتراك</Text>
              {[
                { label: 'أسبوعي', price: '$2.99', days: '7 أيام', icon: 'flash-outline' as const, color: '#F59E0B' },
                { label: 'شهري', price: '$7.99', days: '30 يوماً', icon: 'calendar-outline' as const, color: Colors.brand.primary },
                { label: 'سنوي', price: '$59.99', days: '365 يوماً', icon: 'star-outline' as const, color: '#10B981', badge: 'الأفضل قيمة' },
              ].map((p) => (
                <View key={p.label} style={[styles.planRow, { backgroundColor: colors.cardBackground }]}>
                  <View style={[styles.planIcon, { backgroundColor: p.color + '22' }]}>
                    <Ionicons name={p.icon} size={22} color={p.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planName, { color: colors.text }]}>{p.label}</Text>
                    <Text style={[styles.planDays, { color: colors.textSecondary }]}>{p.days}</Text>
                  </View>
                  {p.badge && (
                    <View style={[styles.bestBadge, { backgroundColor: p.color }]}>
                      <Text style={styles.bestBadgeText}>{p.badge}</Text>
                    </View>
                  )}
                  <Text style={[styles.planPrice, { color: p.color }]}>{p.price}</Text>
                </View>
              ))}

              <Text style={[styles.contactNote, { color: colors.textSecondary }]}>
                للحصول على كود تفعيل، تواصل مع أحد وكلائنا المعتمدين
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Colors.fonts.bold, fontSize: 18 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  center: { alignItems: 'center', paddingTop: 60, gap: 14 },
  emptyText: { fontFamily: Colors.fonts.medium, fontSize: 15 },
  loginBtn: {
    paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 12, marginTop: 8, overflow: 'hidden',
  },
  loginBtnText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 14 },

  premiumCard: { borderRadius: 18, padding: 20, gap: 14 },
  premiumTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  crownWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  premiumLabel: { fontFamily: Colors.fonts.extraBold, color: '#fff', fontSize: 18 },
  premiumSub: { fontFamily: Colors.fonts.regular, color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  activePill: {
    backgroundColor: '#22C55E', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  activePillText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 11 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expiryText: { fontFamily: Colors.fonts.medium, color: 'rgba(255,255,255,0.85)', fontSize: 13, flex: 1 },
  daysLeftBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  daysLeftText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 11 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  featureItemText: { fontFamily: Colors.fonts.medium, color: '#fff', fontSize: 12 },

  freeCard: { borderRadius: 16, padding: 20, gap: 14 },
  freeTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  freeLabel: { fontFamily: Colors.fonts.bold, fontSize: 17 },
  freeSub: { fontFamily: Colors.fonts.regular, fontSize: 13 },
  limitedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12 },
  limitedText: { fontFamily: Colors.fonts.medium, fontSize: 12, flex: 1 },

  activateSection: { borderRadius: 16, padding: 18, gap: 10 },
  activateTitle: { fontFamily: Colors.fonts.bold, fontSize: 16 },
  activateDesc: { fontFamily: Colors.fonts.regular, fontSize: 12 },
  codeInputRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 2,
  },
  codeInput: {
    flex: 1, fontFamily: Colors.fonts.bold, fontSize: 15,
    textAlign: 'center', paddingVertical: 12, letterSpacing: 1,
  },
  activateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 14,
  },
  activateBtnText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 14 },

  plansTitle: { fontFamily: Colors.fonts.bold, fontSize: 16 },
  planRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
  },
  planIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  planName: { fontFamily: Colors.fonts.bold, fontSize: 14 },
  planDays: { fontFamily: Colors.fonts.regular, fontSize: 12 },
  planPrice: { fontFamily: Colors.fonts.extraBold, fontSize: 16 },
  bestBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  bestBadgeText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 10 },
  contactNote: { fontFamily: Colors.fonts.regular, fontSize: 12, textAlign: 'center', lineHeight: 20 },
});
