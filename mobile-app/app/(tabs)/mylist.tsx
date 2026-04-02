import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { VodItem, isLoggedIn, apiFetch } from '@/constants/Api';
const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 3;
const CARD_H = CARD_W * 1.52;

function SkeletonMyList({ colors }: { colors: any }) {
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
  return (
    <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 16 }}>
      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[0, 1, 2].map((col) => (
            <Animated.View key={col} style={{ width: CARD_W, height: CARD_H, borderRadius: 12, backgroundColor: colors.inputBackground, opacity: pulse }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function MyListScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [vodFavs, setVodFavs] = useState<VodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const logged = await isLoggedIn();
      setLoggedIn(logged);
      if (!logged) return;
      const res = await apiFetch('/api/vod/favorites/list');
      const data = await res.json();
      setVodFavs(data.vod || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePress = useCallback((item: any) => {
    router.push({ pathname: '/detail', params: { tmdbId: item.id, type: item.content_type || 'movie', title: item.title || '', poster: item.poster || '' } });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity style={[styles.card, { height: CARD_H }]} onPress={() => handlePress(item)} activeOpacity={0.75}>
      {item.poster ? (
        <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={[styles.noPoster, { backgroundColor: colors.inputBackground }]}>
          <Ionicons name="film-outline" size={24} color={colors.textSecondary} />
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
        locations={[0.38, 0.68, 1]}
        style={styles.gradient}
      />
      <View style={[styles.badge, { backgroundColor: item.content_type === 'movie' ? 'rgba(255,184,0,0.92)' : 'rgba(99,102,241,0.92)' }]}>
        <Text style={styles.badgeText}>{item.content_type === 'movie' ? 'فيلم' : 'مسلسل'}</Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  ), [handlePress, colors.inputBackground, colors.textSecondary]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>قائمتي</Text>
        <View style={styles.logoRow}>
          <Ionicons name="wifi" size={12} color={Colors.brand.primary} style={{ transform: [{ rotate: '45deg' }] }} />
          <Text style={styles.logoSmall}>MA</Text>
        </View>
      </View>

      {loading ? (
        <SkeletonMyList colors={colors} />
      ) : !loggedIn ? (
        <View style={styles.center}>
          <Ionicons name="person-outline" size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>سجل الدخول لعرض قائمتك</Text>
        </View>
      ) : vodFavs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bookmark-outline" size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا يوجد محتوى محفوظ</Text>
          <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>أضف أفلام ومسلسلات للمفضلة</Text>
        </View>
      ) : (
        <FlatList
          data={vodFavs}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.brand.primary} />}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10, direction: 'rtl',
  },
  headerTitle: { fontFamily: Colors.fonts.extraBold, fontSize: 22, textAlign: 'right' },
  logoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  logoSmall: { fontFamily: Colors.fonts.extraBold, color: Colors.brand.primary, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: Colors.fonts.medium, fontSize: 15 },
  emptySubText: { fontFamily: Colors.fonts.regular, fontSize: 12 },
  grid: { paddingHorizontal: 12, paddingBottom: 30, paddingTop: 16 },
  row: { flexDirection: 'row-reverse', justifyContent: 'flex-start', gap: 8, marginBottom: 10 },
  card: { width: CARD_W, borderRadius: 12, overflow: 'hidden' },
  poster: { width: '100%', height: '100%', position: 'absolute' },
  noPoster: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '68%' },
  badge: { position: 'absolute', top: 7, right: 7, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 9, letterSpacing: 0.3 },
  cardBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 7, paddingBottom: 8 },
  cardTitle: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 10, textAlign: 'right', lineHeight: 14, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
});
