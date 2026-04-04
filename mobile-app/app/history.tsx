import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowBackIcon, PersonIcon, ClockIcon, FilmIcon, ChevronIcon } from '@/components/AppIcons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { fetchWatchHistory, isLoggedIn, WatchHistoryItem } from '@/constants/Api';

function SkeletonHistory({ colors }: { colors: any }) {
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
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'center' }}>
          <Animated.View style={{ width: 72, height: 100, borderRadius: 10, backgroundColor: colors.inputBackground, opacity: pulse }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Animated.View style={{ height: 14, borderRadius: 7, backgroundColor: colors.inputBackground, opacity: pulse, width: '80%' }} />
            <Animated.View style={{ height: 11, borderRadius: 6, backgroundColor: colors.inputBackground, opacity: pulse, width: '50%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const logged = await isLoggedIn();
      setLoggedIn(logged);
      if (!logged) return;
      const data = await fetchWatchHistory({ limit: 50 });
      setItems(data.items);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePress = useCallback((item: WatchHistoryItem) => {
    router.push({ pathname: '/detail', params: { xtreamId: item.item_id, vodType: item.content_type === 'series' || item.content_type === 'tv' ? 'series' : 'movie', title: item.title, poster: item.poster } });
  }, [router]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' });

  const renderItem = useCallback(({ item }: { item: WatchHistoryItem }) => (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.cardBackground }]} onPress={() => handlePress(item)} activeOpacity={0.8}>
      <View style={styles.posterWrap}>
        {item.poster ? (
          <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.noPoster, { backgroundColor: colors.inputBackground }]}>
            <FilmIcon size={22} color={colors.textSecondary} />
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.posterGrad} />
        <View style={[styles.typePill, { backgroundColor: item.content_type === 'movie' ? 'rgba(255,184,0,0.9)' : 'rgba(99,102,241,0.9)' }]}>
          <Text style={styles.typePillText}>{item.content_type === 'movie' ? 'فيلم' : 'مسلسل'}</Text>
        </View>
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>{item.title || item.item_id}</Text>
        <View style={styles.rowMeta}>
          <ClockIcon size={11} color={colors.textSecondary} />
          <Text style={[styles.rowDate, { color: colors.textSecondary }]}>{formatDate(item.watched_at)}</Text>
        </View>
      </View>
      <ChevronIcon size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  ), [handlePress, colors.cardBackground, colors.inputBackground, colors.textSecondary, colors.text]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowBackIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>سجل المشاهدة</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <SkeletonHistory colors={colors} />
      ) : !loggedIn ? (
        <View style={styles.center}>
          <PersonIcon size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>سجل الدخول لعرض سجلك</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <ClockIcon size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>سجل المشاهدة فارغ</Text>
          <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>سيظهر هنا ما تشاهده</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Colors.fonts.bold, fontSize: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: Colors.fonts.medium, fontSize: 15 },
  emptySubText: { fontFamily: Colors.fonts.regular, fontSize: 12 },
  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, padding: 10,
  },
  posterWrap: { width: 54, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  poster: { width: 54, height: 80 },
  posterGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  noPoster: { width: 54, height: 80, alignItems: 'center', justifyContent: 'center' },
  typePill: { position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' },
  typePillText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 8, letterSpacing: 0.2 },
  rowInfo: { flex: 1 },
  rowTitle: { fontFamily: Colors.fonts.bold, fontSize: 13, lineHeight: 18 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  rowDate: { fontFamily: Colors.fonts.regular, fontSize: 11 },
});
