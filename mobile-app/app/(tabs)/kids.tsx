import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Animated,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppLogo from '@/components/AppLogo';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import {
  fetchIptvCategoriesWithMovies,
  fetchFreeChannels, IptvVodItem, IptvCategoryWithMovies, FreeChannel,
} from '@/constants/Api';
import ContentRow from '@/components/ContentRow';
import SkeletonRow from '@/components/SkeletonRow';
import LiveChannelRow from '@/components/LiveChannelRow';

const HEADER_H = 50;

function toContentItem(v: IptvVodItem) {
  return { id: v.id, title: v.name, poster: v.poster, vod_type: v.vod_type, year: v.year, rating: v.rating };
}

const KIDS_KEYWORDS = ['كرتون', 'أنيميشن', 'أنمي', 'أطفال', 'animation', 'cartoon', 'anime', 'kids'];

export default function KidsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [catRows, setCatRows] = useState<IptvCategoryWithMovies[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalHeader = HEADER_H + insets.top;
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScroll = useRef(Animated.diffClamp(scrollY, 0, HEADER_H)).current;
  const headerTranslateY = clampedScroll.interpolate({ inputRange: [0, HEADER_H], outputRange: [0, -totalHeader], extrapolate: 'clamp' });
  const headerOpacity = clampedScroll.interpolate({ inputRange: [0, HEADER_H * 0.8], outputRange: [1, 0], extrapolate: 'clamp' });

  const loadData = useCallback(async () => {
    try {
      const [chData, catsData] = await Promise.all([
        fetchFreeChannels({ group: 'أطفال', limit: 20 }).catch(() => ({ channels: [] })),
        fetchIptvCategoriesWithMovies(40).catch(() => ({ categories: [], total: 0 })),
      ]);
      setChannels(chData.channels || []);
      // Filter categories matching kids/animation keywords
      const kidsCats = (catsData.categories || []).filter(c =>
        KIDS_KEYWORDS.some(kw => c.name.toLowerCase().includes(kw))
      );
      setCatRows(kidsCats);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => { loadData(); });
    return () => task.cancel();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setLoading(true);
    loadData();
  }, [loadData]);

  const handleChannelPress = useCallback((ch: FreeChannel) => {
    router.push({ pathname: '/player', params: { freeChannelId: ch.id, title: ch.name } });
  }, [router]);

  const handleVodPress = useCallback((item: any) => {
    const type = item.vod_type === 'series' ? 'series' : 'movie';
    router.push({ pathname: '/detail', params: { xtreamId: item.id, vodType: type, title: item.title || item.name, poster: item.poster } });
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 6, transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>أطفال</Text>
        <AppLogo size="sm" />
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />}
        contentContainerStyle={{ paddingTop: totalHeader }}
        removeClippedSubviews
      >
        {/* قنوات الأطفال */}
        <LiveChannelRow
          title="قنوات الأطفال"
          channels={channels}
          onChannelPress={handleChannelPress}
          onSeeAll={() => router.push('/live')}
        />

        {/* المحتوى */}
        {loading ? (
          <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
        ) : (
          <>
            {catRows.map(cat => cat.items.length > 0 && (
              <ContentRow
                key={cat.id}
                title={cat.name}
                items={cat.items.map(toContentItem)}
                onItemPress={handleVodPress}
                onSeeAll={() => router.push({ pathname: '/allcontent', params: { categoryId: cat.id, title: cat.name } })}
                showBadge
              />
            ))}
          </>
        )}

        <View style={{ height: 30 }} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  headerTitle: { fontFamily: Colors.fonts.extraBold, fontSize: 22, textAlign: 'right' },
});
