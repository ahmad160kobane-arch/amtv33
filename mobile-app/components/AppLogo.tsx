import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiIcon } from '@/components/AppIcons';
import Colors from '@/constants/Colors';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const CFG = {
  sm: { icon: 14, am: 18, tv: 9,  gap: 5 },
  md: { icon: 18, am: 24, tv: 11, gap: 6 },
  lg: { icon: 26, am: 34, tv: 14, gap: 8 },
};

export default function AppLogo({ size = 'md' }: AppLogoProps) {
  const c = CFG[size];
  return (
    <View style={[styles.wrap, { gap: c.gap }]}>
      <WifiIcon size={c.icon} color={Colors.brand.primary} />
      <View style={styles.textRow}>
        <Text style={[styles.am, { fontSize: c.am }]}>AM</Text>
        <Text style={[styles.tv, { fontSize: c.tv }]}>TV</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  am: {
    fontFamily: Colors.fonts.extraBold,
    color: Colors.brand.primary,
    includeFontPadding: false,
    letterSpacing: 0.5,
  },
  tv: {
    fontFamily: Colors.fonts.bold,
    color: '#FFFFFF',
    includeFontPadding: false,
    marginBottom: 2,
    letterSpacing: 0.3,
  },
});
