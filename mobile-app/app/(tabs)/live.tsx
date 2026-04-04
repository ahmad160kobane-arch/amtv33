import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
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
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { RadioIcon, SearchIcon, CloseCircleIcon } from '@/components/AppIcons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { fetchFreeChannels, FreeChannel } from '@/constants/Api';

const { width } = Dimensions.get('window');
const NUM_COLS = 3;
const GRID_GAP = 8;
const GRID_PAD = 12;
const CARD_W = (width - GRID_PAD * 2 - GRID_GAP * (NUM_COLS - 1)) / NUM_COLS;
const CARD_H = CARD_W * 1.45;
const PAGE_SIZE = 30;
const HEADER_H = 52;

const ChannelCard = memo(({ item, colors, router }: { item: FreeChannel; colors: any; router: any }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }], width: CARD_W }}>
      <TouchableOpacity
        style={[styles.card, { height: CARD_H, backgroundColor: colors.cardBackground }]}
        onPress={() => router.push({ pathname: '/player', params: { freeChannelId: item.id, title: item.name } })}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={[styles.logoBg, { backgroundColor: colors.cardBackground }]}>
          {item.logo ? (
            <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
          ) : (
            <RadioIcon size={30} color={colors.textSecondary} />
          )}
        </View>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.92)']}
          locations={[0.32, 0.62, 1]}
          style={styles.gradient}
        />
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>مباشر</Text>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
          {item.group ? <Text style={styles.cardGroup} numberOfLines={1}>{item.group}</Text> : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

function SkeletonGrid({ colors, pulse }: { colors: any; pulse: Animated.Value }) {
  return (
    <View style={{ paddingHorizontal: GRID_PAD, paddingTop: 8 }}>
      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={{ flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP }}>
          {[0, 1, 2].map((col) => (
            <Animated.View key={col} style={{ width: CARD_W, height: CARD_H, borderRadius: 10, backgroundColor: colors.inputBackground, opacity: pulse }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function LiveTabScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

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

  const totalHeader = HEADER_H + insets.top;
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScroll = useRef(Animated.diffClamp(scrollY, 0, HEADER_H)).current;
  const headerTranslateY = clampedScroll.interpolate({ inputRange: [0, HEADER_H], outputRange: [0, -totalHeader], extrapolate: 'clamp' });
  const headerOpacity = clampedScroll.interpolate({ inputRange: [0, HEADER_H * 0.8], outputRange: [1, 0], extrapolate: 'clamp' });

  const loadData = useCallback(async (reset = true) => {
    try {
      if (reset) setLoading(true);
      const offset = reset ? 0 : channels.length;
      const data = await fetchFreeChannels({
        group: selectedCategory || undefined,
        search: searchQuery || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      if (reset) {
        setChannels(data.channels);
        if (data.categories?.length > 0) setCategories(data.categories);
      } else {
        setChannels(prev => {
          const ids = new Set(prev.map(i => i.id));
          return [...prev, ...data.channels.filter(i => !ids.has(i.id))];
        });
      }
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch {} finally {
      setRefreshing(false);
      setLoadingMore(false);
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => { loadData(true); }, [loadData]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    loadData(false);
  }, [hasMore, loadingMore, loading, loadData]);

  const renderChannel = useCallback(({ item }: { item: FreeChannel }) => (
    <ChannelCard item={item} colors={colors} router={router} />
  ), [colors, router]);

  const ListHeader = useCallback(() => (
    <View style={{ paddingTop: totalHeader + 4 }}>
      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground }]}>
        <SearchIcon size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="ابحث عن قناة..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => loadData(true)}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); }}>
            <CloseCircleIcon size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
          style={styles.categoriesList}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === cat ? Colors.brand.primary : colors.cardBackground,
                  borderColor: selectedCategory === cat ? Colors.brand.primary : colors.cardBorder,
                }
              ]}
              onPress={() => setSelectedCategory(prev => prev === cat ? '' : cat)}
            >
              <Text style={[
                styles.categoryText,
                { color: selectedCategory === cat ? '#fff' : colors.text }
              ]} numberOfLines={1}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  ), [totalHeader, colors, searchQuery, categories, selectedCategory]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Animated Header */}
      <Animated.View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 4, transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }]}>
        <View style={styles.headerRight}>
          <RadioIcon size={18} color={Colors.brand.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>البث المباشر</Text>
        </View>
        <Text style={[styles.headerCount, { color: colors.textSecondary }]}>{total} قناة</Text>
      </Animated.View>

      {/* Channels Grid */}
      {loading ? (
        <View style={{ paddingTop: totalHeader + 70 }}>
          <SkeletonGrid colors={colors} pulse={pulse} />
        </View>
      ) : (
        <Animated.FlatList
          data={channels}
          renderItem={renderChannel}
          keyExtractor={(item, index) => `${item.id}_${index}`}
          numColumns={NUM_COLS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={5}
          initialNumToRender={12}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} tintColor={Colors.brand.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={Colors.brand.primary} />
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>جاري التحميل...</Text>
            </View>
          ) : <View style={{ height: 30 }} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <RadioIcon size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.text }]}>لا توجد قنوات حالياً</Text>
                <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>اسحب للأسفل لتحديث القائمة</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: Colors.fonts.bold, fontSize: 19, flexShrink: 1 },
  headerCount: { fontFamily: Colors.fonts.regular, fontSize: 12 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: GRID_PAD, marginBottom: 10,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, gap: 6,
  },
  searchInput: { flex: 1, fontFamily: Colors.fonts.regular, fontSize: 13, textAlign: 'right', writingDirection: 'rtl', paddingVertical: 0 },
  categoriesList: { maxHeight: 38, marginBottom: 10 },
  categoriesContainer: { paddingHorizontal: GRID_PAD, gap: 6 },
  categoryChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, borderWidth: 1,
  },
  categoryText: { fontFamily: Colors.fonts.medium, fontSize: 11 },
  grid: { paddingHorizontal: GRID_PAD, paddingBottom: 10 },
  row: { gap: GRID_GAP, marginBottom: GRID_GAP },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
      android: { elevation: 5 },
    }),
  },
  logoBg: {
    width: '100%', height: '100%', position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  logo: { width: '65%', height: '50%' },
  gradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '68%',
  },
  liveBadge: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(52,199,89,0.18)', borderWidth: 1, borderColor: 'rgba(52,199,89,0.45)',
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#34C759' },
  liveBadgeText: { fontFamily: Colors.fonts.bold, fontSize: 9, color: '#34C759' },
  cardBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 7, paddingBottom: 9,
  },
  cardTitle: {
    fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 12,
    textAlign: 'right', lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  cardGroup: {
    fontFamily: Colors.fonts.regular, color: 'rgba(255,255,255,0.65)', fontSize: 10,
    textAlign: 'right', marginTop: 2,
  },
  footerLoader: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  footerText: { fontFamily: Colors.fonts.regular, fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontFamily: Colors.fonts.medium, fontSize: 14 },
  emptySubText: { fontFamily: Colors.fonts.regular, fontSize: 12 },
});
