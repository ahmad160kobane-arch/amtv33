import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowBackIcon, NotificationIcon, LiveIcon, VideoIcon, TrashIcon,
  InfoIcon, ShieldIcon, DocumentIcon, ChevronIcon,
} from '@/components/AppIcons';

type SettingIconKey = 'notification' | 'autoplay' | 'hd' | 'trash' | 'info' | 'shield' | 'document';

function renderSettingIcon(key: SettingIconKey, size: number, color: string) {
  switch (key) {
    case 'notification': return <NotificationIcon size={size} color={color} />;
    case 'autoplay': return <LiveIcon size={size} color={color} />;
    case 'hd': return <VideoIcon size={size} color={color} />;
    case 'trash': return <TrashIcon size={size} color={color} />;
    case 'info': return <InfoIcon size={size} color={color} />;
    case 'shield': return <ShieldIcon size={size} color={color} />;
    case 'document': return <DocumentIcon size={size} color={color} />;
    default: return <InfoIcon size={size} color={color} />;
  }
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [hdQuality, setHdQuality] = useState(true);

  const clearCache = useCallback(async () => {
    Alert.alert('مسح الكاش', 'سيتم حذف البيانات المؤقتة. هل تريد المتابعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'مسح', style: 'destructive',
        onPress: async () => {
          try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(k => k.startsWith('cache_') || k.startsWith('img_'));
            if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
            Alert.alert('تم', 'تم مسح الكاش بنجاح');
          } catch { Alert.alert('خطأ', 'فشل مسح الكاش'); }
        },
      },
    ]);
  }, []);

  interface SettingItem {
    icon: SettingIconKey;
    label: string;
    subtitle?: string;
    toggle?: boolean;
    value?: boolean;
    onToggle?: (v: boolean) => void;
    onPress?: () => void;
  }
  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: 'عام',
      items: [
        { icon: 'notification', label: 'الإشعارات', toggle: true, value: notifications, onToggle: setNotifications },
        { icon: 'autoplay', label: 'تشغيل تلقائي', toggle: true, value: autoPlay, onToggle: setAutoPlay },
        { icon: 'hd', label: 'جودة عالية', subtitle: 'تفعيل HD عند توفره', toggle: true, value: hdQuality, onToggle: setHdQuality },
      ],
    },
    {
      title: 'التخزين',
      items: [
        { icon: 'trash', label: 'مسح الكاش', subtitle: 'حذف البيانات المؤقتة', onPress: clearCache },
      ],
    },
    {
      title: 'حول التطبيق',
      items: [
        { icon: 'info', label: 'الإصدار', subtitle: '1.0.0' },
        { icon: 'shield', label: 'سياسة الخصوصية', onPress: () => {} },
        { icon: 'document', label: 'الشروط والأحكام', onPress: () => {} },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowBackIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>الإعدادات</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {sections.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
            <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground }]}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={ii}
                  style={[styles.row, ii < section.items.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.divider }]}
                  onPress={item.onPress}
                  activeOpacity={item.onPress ? 0.55 : 1}
                  disabled={!item.onPress && !item.toggle}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.inputBackground }]}>
                      {renderSettingIcon(item.icon, 18, Colors.brand.primary)}
                    </View>
                    <View>
                      <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
                      {item.subtitle && <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{item.subtitle}</Text>}
                    </View>
                  </View>
                  {item.toggle ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{ false: colors.inputBackground, true: Colors.brand.primary }}
                      thumbColor="#fff"
                    />
                  ) : item.onPress ? (
                    <ChevronIcon size={18} color={colors.textSecondary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
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
  content: { paddingHorizontal: 16, paddingBottom: 30 },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: Colors.fonts.medium, fontSize: 12, marginBottom: 8, paddingHorizontal: 4 },
  sectionCard: { borderRadius: 14, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: Colors.fonts.medium, fontSize: 15 },
  rowSub: { fontFamily: Colors.fonts.regular, fontSize: 11, marginTop: 1 },
});
