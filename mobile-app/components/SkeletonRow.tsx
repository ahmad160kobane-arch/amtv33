import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';

const { width } = Dimensions.get('window');
const CARD_W = width * 0.34;
const CARD_H = CARD_W * 1.52;
const HERO_H = width * 0.58;

export function SkeletonHero() {
  const colorScheme = useColorScheme();
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  const bg = colorScheme === 'dark' ? '#1C1C1E' : '#E5E5EA';
  return (
    <View style={[styles.hero, { marginBottom: 22 }]}>
      <Animated.View style={[styles.heroBg, { backgroundColor: bg, opacity: pulse }]} />
      <View style={styles.heroContent}>
        <View style={[styles.heroPills, { backgroundColor: 'transparent' }]}>
          <Animated.View style={[styles.heroPill, { backgroundColor: bg, opacity: pulse }]} />
          <Animated.View style={[styles.heroPill, { backgroundColor: bg, opacity: pulse, width: 36 }]} />
        </View>
        <Animated.View style={[styles.heroTitle, { backgroundColor: bg, opacity: pulse }]} />
        <Animated.View style={[styles.heroTitle, { backgroundColor: bg, opacity: pulse, width: '55%', marginTop: 6 }]} />
        <Animated.View style={[styles.heroGenre, { backgroundColor: bg, opacity: pulse, marginTop: 10 }]} />
        <Animated.View style={[styles.heroBtn, { backgroundColor: bg, opacity: pulse, marginTop: 14 }]} />
      </View>
    </View>
  );
}

export default function SkeletonRow({ count = 4 }: { count?: number }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const bg = colorScheme === 'dark' ? '#1C1C1E' : '#E5E5EA';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animated.View style={[styles.titleBar, { backgroundColor: bg, opacity: pulse }]} />
        <Animated.View style={[styles.seeAllBar, { backgroundColor: bg, opacity: pulse }]} />
      </View>
      <View style={styles.row}>
        {Array.from({ length: count }).map((_, i) => (
          <Animated.View key={i} style={[styles.card, { backgroundColor: bg, opacity: pulse }]}>
            <View style={[styles.shimmerOverlay, { backgroundColor: colors.cardBackground }]} />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 28 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleBar: { width: 110, height: 16, borderRadius: 8 },
  seeAllBar: { width: 48, height: 13, borderRadius: 6 },
  row: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  card: { width: CARD_W, height: CARD_H, borderRadius: 12, overflow: 'hidden' },
  shimmerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.08 },
  // Hero skeleton
  hero: { width, height: HERO_H, position: 'relative' },
  heroBg: { ...StyleSheet.absoluteFillObject },
  heroContent: { position: 'absolute', bottom: 18, right: 16, left: 16, alignItems: 'flex-start' },
  heroPills: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  heroPill: { height: 22, width: 48, borderRadius: 20 },
  heroTitle: { height: 18, width: '75%', borderRadius: 9 },
  heroGenre: { height: 12, width: '40%', borderRadius: 6 },
  heroBtn: { height: 36, width: 110, borderRadius: 22 },
});
