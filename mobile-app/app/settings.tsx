import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [hdQuality, setHdQuality] = useState(true);

  interface SettingItem {
    icon: IoniconsName;
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
        { icon: 'notifications-outline', label: 'الإشعارات', toggle: true, value: notifications, onToggle: setNotifications },
        { icon: 'play-circle-outline', label: 'تشغيل تلقائي', toggle: true, value: autoPlay, onToggle: setAutoPlay },
        { icon: 'videocam-outline', label: 'جودة عالية', toggle: true, value: hdQuality, onToggle: setHdQuality },
      ],
    },
    {
      title: 'حول',
      items: [
        { icon: 'information-circle-outline', label: 'الإصدار', subtitle: '1.0.0' },
        { icon: 'document-text-outline', label: 'الشروط والأحكام', onPress: () => {} },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={colors.text} />
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
                <View
                  key={ii}
                  style={[styles.row, ii < section.items.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.divider }]}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.inputBackground }]}>
                      <Ionicons name={item.icon} size={18} color={Colors.brand.primary} />
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
                    <TouchableOpacity onPress={item.onPress}>
                      <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
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
