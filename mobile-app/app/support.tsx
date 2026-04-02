import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';

export default function SupportScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');

  const faqs = [
    { q: 'كيف أشاهد القنوات المباشرة؟', a: 'اذهب للصفحة الرئيسية واختر أي قناة من قسم البث المباشر.' },
    { q: 'كيف أضيف محتوى للمفضلة؟', a: 'اضغط على أيقونة القلب أو العلامة المرجعية في صفحة الفيلم أو المسلسل.' },
    { q: 'هل يمكنني مشاهدة المحتوى بدون إنترنت؟', a: 'حالياً لا يتوفر التحميل. نعمل على إضافة هذه الميزة قريباً.' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>الدعم</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.contactCard, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="chatbubble-ellipses" size={28} color={Colors.brand.primary} />
          <Text style={[styles.contactTitle, { color: colors.text }]}>تحتاج مساعدة؟</Text>
          <Text style={[styles.contactSub, { color: colors.textSecondary }]}>أرسل لنا رسالة وسنرد عليك</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>الأسئلة الشائعة</Text>
        {faqs.map((faq, i) => (
          <View key={i} style={[styles.faqCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.faqQ, { color: colors.text }]}>{faq.q}</Text>
            <Text style={[styles.faqA, { color: colors.textSecondary }]}>{faq.a}</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>أرسل رسالة</Text>
        <View style={[styles.inputBox, { backgroundColor: colors.cardBackground }]}>
          <TextInput
            style={[styles.textArea, { color: colors.text }]}
            placeholder="اكتب رسالتك هنا..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
            textAlign="right"
            textAlignVertical="top"
          />
        </View>
        <TouchableOpacity
          style={{ opacity: message.trim() ? 1 : 0.5 }}
          onPress={() => {
            if (message.trim()) {
              Alert.alert('تم الإرسال', 'شكراً لتواصلك معنا. سنرد عليك قريباً.');
              setMessage('');
            }
          }}
          activeOpacity={0.82}
        >
          <LinearGradient colors={Colors.brand.gradient} style={styles.sendBtn}>
            <Ionicons name="send" size={16} color="#fff" />
            <Text style={styles.sendText}>إرسال</Text>
          </LinearGradient>
        </TouchableOpacity>
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
  contactCard: { borderRadius: 14, padding: 20, alignItems: 'center', gap: 6 },
  contactTitle: { fontFamily: Colors.fonts.bold, fontSize: 16 },
  contactSub: { fontFamily: Colors.fonts.regular, fontSize: 13 },
  sectionTitle: { fontFamily: Colors.fonts.bold, fontSize: 15, marginTop: 8 },
  faqCard: { borderRadius: 12, padding: 14, gap: 4 },
  faqQ: { fontFamily: Colors.fonts.bold, fontSize: 13 },
  faqA: { fontFamily: Colors.fonts.regular, fontSize: 12, lineHeight: 18 },
  inputBox: { borderRadius: 12, padding: 12 },
  textArea: { fontFamily: Colors.fonts.regular, fontSize: 14, minHeight: 80 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 14, overflow: 'hidden',
  },
  sendText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 15 },
});
