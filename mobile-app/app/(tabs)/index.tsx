import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Animated,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsIcon, SearchIcon } from '@/components/AppIcons';
import AppLogo from '@/components/AppLogo';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import {
  fetchVidsrcHome, fetchFreeChannels, VidsrcItem, FreeChannel,
} from '@/constants/Api';
import HeroSlider from '@/components/HeroSlider';
import ContentRow from '@/components/ContentRow';
import LiveChannelRow from '@/components/LiveChannelRow';
import SkeletonRow, { SkeletonHero } from '@/components/SkeletonRow';

const HEADER_H = 50;

function toContentItem(v: VidsrcItem) {
  return { id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, year: v.year, rating: v.rating };
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [movies, setMovies] = useState<VidsrcItem[]>([]);
  const [tvShows, setTvShows] = useState<VidsrcItem[]>([]);
  const [trending, setTrending] = useState<VidsrcItem[]>([]);
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalHeader = HEADER_H + insets.top;
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScroll = useRef(Animated.diffClamp(scrollY, 0, HEADER_H)).current;
  const headerTranslateY = clampedScroll.interpolate({ inputRange: [0, HEADER_H], outputRange: [0, -totalHeader], extrapolate: 'clamp' });
  const headerOpacity = clampedScroll.interpolate({ inputRange: [0, HEADER_H * 0.8], outputRange: [1, 0], extrapolate: 'clamp' });

  // تحميل البيانات الأساسية
  const loadData = useCallback(async () => {
    try {
      const [homeData, chData] = await Promise.all([
        fetchVidsrcHome(),
        fetchFreeChannels({ limit: 10 }),
      ]);
      setMovies(homeData.latestMovies || []);
      setTvShows(homeData.latestTvShows || []);
      setTrending(homeData.trending || []);
      setChannels(chData?.channels || []);
    } catch (e) {
      console.log('[Home] load error:', e);
    } finally {
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
    loadData();
  }, [loadData]);

  const heroItems = useMemo(() => [...(trending.filter(v => v.poster).slice(0, 3)), ...(movies.filter(v => v.poster).slice(0, 3))]
    .map(v => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, year: v.year, rating: v.rating, genres: v.genres || [] })),
  [trending, movies]);

  const handleVodPress = useCallback((item: any) => {
    const type = item.vod_type === 'series' ? 'series' : 'movie';
    router.push({ pathname: '/detail', params: { tmdbId: item.tmdb_id || item.id, vodType: type, title: item.title, poster: item.poster } });
  }, [router]);

  const handleChannelPress = useCallback((ch: FreeChannel) => {
    router.push({ pathname: '/player', params: { freeChannelId: ch.id, title: ch.name } });
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 6, transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }]}>
        <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <SettingsIcon size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <AppLogo size="sm" />
        <TouchableOpacity onPress={() => router.push('/allcontent' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <SearchIcon size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />
        }
        contentContainerStyle={{ paddingTop: totalHeader }}
        removeClippedSubviews
      >
        {loading && heroItems.length === 0 ? <SkeletonHero /> : heroItems.length > 0 ? <HeroSlider items={heroItems} onItemPress={handleVodPress} /> : null}

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {trending.length > 0 && (
              <ContentRow
                title="الأكثر مشاهدةً"
                items={trending.map(toContentItem)}
                onItemPress={handleVodPress}
                onSeeAll={() => router.push('/allcontent' as any)}
                showBadge
              />
            )}
            {movies.length > 0 && (
              <ContentRow
                title="أحدث الأفلام"
                items={movies.map(toContentItem)}
                onItemPress={handleVodPress}
                onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie' } })}
                showBadge
              />
            )}
            {tvShows.length > 0 && (
              <ContentRow
                title="أحدث المسلسلات"
                items={tvShows.map(toContentItem)}
                onItemPress={handleVodPress}
                onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'series' } })}
                showBadge
              />
            )}
          </>
        )}

        {/* البث المباشر */}
        <LiveChannelRow
          title="البث المباشر"
          channels={channels}
          onChannelPress={handleChannelPress}
          onSeeAll={() => router.push('/live')}
        />

        <View style={{ height: 30 }} />
      </Animated.ScrollView>
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
    paddingVertical: 10,
  },
});
