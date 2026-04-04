import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowBackIcon, ShieldIcon } from '@/components/AppIcons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';

export default function PrivacyScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const sections = [
    { title: 'جمع البيانات', body: 'نقوم بجمع بيانات الحساب الأساسية فقط (اسم المستخدم، البريد الإلكتروني) لتوفير خدماتنا. لا نشارك بياناتك مع أطراف ثالثة.' },
    { title: 'ملفات تعريف الارتباط', body: 'نستخدم رموز JWT للمصادقة فقط. لا نستخدم ملفات تعريف ارتباط للتتبع.' },
    { title: 'سجل المشاهدة', body: 'يتم حفظ سجل المشاهدة محلياً لتحسين تجربتك. يمكنك حذفه في أي وقت من الإعدادات.' },
    { title: 'أمان البيانات', body: 'يتم تشفير كلمات المرور باستخدام خوارزمية bcrypt. جميع الاتصالات مؤمنة.' },
    { title: 'حقوقك', body: 'يمكنك طلب حذف حسابك وجميع بياناتك في أي وقت عبر التواصل مع الدعم.' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowBackIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>الخصوصية</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: colors.cardBackground }]}>
          <ShieldIcon size={32} color={Colors.brand.primary} />
          <Text style={[styles.iconTitle, { color: colors.text }]}>خصوصيتك مهمة لنا</Text>
        </View>

        {sections.map((s, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{s.title}</Text>
            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerTitle: { fontFamily: Colors.fonts.bold, fontSize: 18 },
  content: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },
  iconBox: { borderRadius: 14, padding: 20, alignItems: 'center', gap: 8 },
  iconTitle: { fontFamily: Colors.fonts.bold, fontSize: 16 },
  card: { borderRadius: 12, padding: 16, gap: 6 },
  cardTitle: { fontFamily: Colors.fonts.bold, fontSize: 14 },
  cardBody: { fontFamily: Colors.fonts.regular, fontSize: 13, lineHeight: 20 },
});
