import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { fetchVidsrcBrowse, VidsrcItem } from '@/constants/Api';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 3;
const CARD_H = CARD_W * 1.52;
const PAGE_SIZE = 9;

function SkeletonGrid({ colors }: { colors: any }) {
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
  const bg = colors.inputBackground;
  return (
    <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12 }}>
      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {[0, 1, 2].map((col) => (
            <Animated.View key={col} style={{ width: CARD_W, height: CARD_H, borderRadius: 12, backgroundColor: bg, opacity: pulse }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function AllContentScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; category?: string }>();
  const [items, setItems] = useState<VidsrcItem[]>([]);
  const pageRef = useRef(1);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const loadData = useCallback(async (reset = true) => {
    try {
      if (!reset && loadingMore) return;
      if (reset) { setItems([]); pageRef.current = 1; }
      const page = reset ? 1 : pageRef.current;
      const data = await fetchVidsrcBrowse({ type: params.type || undefined, category: params.category || undefined, page });
      if (reset) {
        setItems(data.items);
        setTotal(data.total ?? data.items.length);
      } else {
        setItems(prev => {
          const ids = new Set(prev.map(i => i.id));
          return [...prev, ...data.items.filter(i => !ids.has(i.id))];
        });
      }
      setHasMore(data.hasMore);
      pageRef.current = data.page + 1;
    } catch {} finally {
      setRefreshing(false);
      setLoadingMore(false);
      setLoading(false);
    }
  }, [params.type, params.category]);

  useEffect(() => { loadData(true); }, [loadData]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    fetchVidsrcBrowse({ type: params.type || undefined, category: params.category || undefined, page: pageRef.current }).then(data => {
      setItems(prev => {
        const ids = new Set(prev.map(i => i.id));
        return [...prev, ...data.items.filter(i => !ids.has(i.id))];
      });
      setHasMore(data.hasMore);
      pageRef.current = data.page + 1;
    }).finally(() => setLoadingMore(false));
  }, [hasMore, loadingMore, params.type, params.category]);

  const categoryLabels: Record<string, string> = {
    action: 'أكشن', comedy: 'كوميدي', drama: 'دراما', horror: 'رعب',
    animation: 'أنيميشن', family: 'عائلي', romance: 'رومانسي',
    thriller: 'إثارة', 'science-fiction': 'خيال علمي', mystery: 'غموض', crime: 'جريمة',
  };
  const baseTitle = params.type === 'movie' ? 'أفلام' : params.type === 'tv' ? 'مسلسلات' : 'محتوى';
  const catLabel = params.category ? (categoryLabels[params.category] || params.category) : '';
  const title = catLabel ? `${catLabel} - ${baseTitle}` : `جميع ${baseTitle}`;

  const handlePress = useCallback((item: VidsrcItem) => {
    const type = item.vod_type === 'series' ? 'tv' : 'movie';
    router.push({ pathname: '/detail', params: { tmdbId: item.tmdb_id || item.id, type, title: item.title, poster: item.poster } });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: VidsrcItem }) => {
    const ratingVal = item.rating ? parseFloat(item.rating) : 0;
    return (
      <TouchableOpacity style={[styles.card, { height: CARD_W * 1.52 }]} onPress={() => handlePress(item)} activeOpacity={0.75}>
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
        <View style={[styles.badge, { backgroundColor: item.vod_type === 'movie' ? 'rgba(255,184,0,0.92)' : 'rgba(99,102,241,0.92)' }]}>
          <Text style={styles.badgeText}>{item.vod_type === 'movie' ? 'فيلم' : 'مسلسل'}</Text>
        </View>
        {ratingVal > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={8} color="#FFB800" />
            <Text style={styles.ratingText}>{ratingVal.toFixed(1)}</Text>
          </View>
        )}
        <View style={styles.cardBottom}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          {item.year ? <Text style={styles.cardYear}>{item.year}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  }, [handlePress, colors.inputBackground, colors.textSecondary]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title} ({total})</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <SkeletonGrid colors={colors} />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}_${index}`}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={9}
          windowSize={5}
          initialNumToRender={12}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} tintColor={Colors.brand.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={Colors.brand.primary} />
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>جاري التحميل...</Text>
            </View>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Colors.fonts.bold, fontSize: 18 },
  grid: { paddingHorizontal: 12, paddingBottom: 30 },
  row: { justifyContent: 'flex-start', gap: 8, marginBottom: 10 },
  card: { width: CARD_W, borderRadius: 12, overflow: 'hidden' },
  poster: { width: '100%', height: '100%', position: 'absolute' },
  noPoster: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '68%' },
  badge: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 9, letterSpacing: 0.3 },
  ratingBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.68)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  ratingText: { fontFamily: Colors.fonts.bold, color: '#FFB800', fontSize: 9 },
  cardBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 7, paddingBottom: 8 },
  cardTitle: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 10, textAlign: 'right', lineHeight: 14, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  cardYear: { fontFamily: Colors.fonts.regular, color: 'rgba(255,255,255,0.5)', fontSize: 9, textAlign: 'right', marginTop: 2 },
  footerLoader: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  footerText: { fontFamily: Colors.fonts.regular, fontSize: 12 },
});
