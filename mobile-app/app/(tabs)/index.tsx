import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Animated,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { fetchVidsrcHome, fetchFreeChannels, fetchVidsrcBrowse, VidsrcItem, FreeChannel } from '@/constants/Api';
import HeroSlider from '@/components/HeroSlider';
import ContentRow from '@/components/ContentRow';
import SkeletonRow, { SkeletonHero } from '@/components/SkeletonRow';

const HEADER_H = 50;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [movies, setMovies] = useState<VidsrcItem[]>([]);
  const [series, setSeries] = useState<VidsrcItem[]>([]);
  const [trending, setTrending] = useState<VidsrcItem[]>([]);
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // أقسام إضافية - 6 فقط لتجنب البطء
  const [actionMovies, setActionMovies] = useState<VidsrcItem[]>([]);
  const [comedyMovies, setComedyMovies] = useState<VidsrcItem[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<VidsrcItem[]>([]);
  const [animationMovies, setAnimationMovies] = useState<VidsrcItem[]>([]);
  const [dramaSeries, setDramaSeries] = useState<VidsrcItem[]>([]);
  const [crimeSeries, setCrimeSeries] = useState<VidsrcItem[]>([]);
  const [extraLoaded, setExtraLoaded] = useState(false);

  const totalHeader = HEADER_H + insets.top;
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScroll = useRef(Animated.diffClamp(scrollY, 0, HEADER_H)).current;
  const headerTranslateY = clampedScroll.interpolate({ inputRange: [0, HEADER_H], outputRange: [0, -totalHeader], extrapolate: 'clamp' });
  const headerOpacity = clampedScroll.interpolate({ inputRange: [0, HEADER_H * 0.8], outputRange: [1, 0], extrapolate: 'clamp' });

  // تحميل البيانات الأساسية أولاً
  const loadData = useCallback(async () => {
    try {
      const [homeData, chData] = await Promise.all([
        fetchVidsrcHome(),
        fetchFreeChannels({ limit: 8 }),
      ]);
      setMovies(homeData.latestMovies || []);
      setSeries(homeData.latestTvShows || []);
      setTrending(homeData.trending || []);
      setChannels(chData?.channels || []);
    } catch (e) {
      console.log('Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // تحميل الأقسام الإضافية — كلها بالتوازي
  const loadExtraCategories = useCallback(async () => {
    if (extraLoaded) return;
    try {
      await Promise.all([
        fetchVidsrcBrowse({ type: 'movie', category: 'action',    page: 1 }).then(d => setActionMovies(d.items?.slice(0, 10) || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'movie', category: 'comedy',    page: 1 }).then(d => setComedyMovies(d.items?.slice(0, 10) || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'movie', category: 'horror',    page: 1 }).then(d => setHorrorMovies(d.items?.slice(0, 10) || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'movie', category: 'animation', page: 1 }).then(d => setAnimationMovies(d.items?.slice(0, 10) || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'tv',    category: 'drama',     page: 1 }).then(d => setDramaSeries(d.items?.slice(0, 10) || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'tv',    category: 'crime',     page: 1 }).then(d => setCrimeSeries(d.items?.slice(0, 10) || [])).catch(() => {}),
      ]);
      setExtraLoaded(true);
    } catch {}
  }, [extraLoaded]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => { loadData(); });
    return () => task.cancel();
  }, [loadData]);

  // تحميل الأقسام الإضافية بعد انتهاء التحميل الأولي
  useEffect(() => {
    if (!loading && !extraLoaded) {
      loadExtraCategories();
    }
  }, [loading, extraLoaded, loadExtraCategories]);

  const onRefresh = useCallback(() => {
    setExtraLoaded(false);
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const heroItems = useMemo(() => trending
    .filter((v) => v.backdrop || v.poster)
    .slice(0, 6)
    .map((v) => ({ id: v.id, title: v.title, poster: v.backdrop || v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating, genres: v.genres })),
  [trending]);

  const handleVodPress = useCallback((item: any) => {
    const type = item.vod_type === 'series' ? 'tv' : 'movie';
    router.push({ pathname: '/detail', params: { tmdbId: item.tmdb_id || item.id, type, title: item.title, poster: item.poster } });
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 6, transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }]}>
        <TouchableOpacity onPress={() => router.push('/live')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.logoRow}>
          <Ionicons name="wifi" size={16} color={Colors.brand.primary} style={{ transform: [{ rotate: '45deg' }] }} />
          <Text style={styles.logoText}>MA</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/allcontent' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="search-outline" size={22} color={colors.textSecondary} />
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
      >
        {loading && heroItems.length === 0 ? <SkeletonHero /> : heroItems.length > 0 ? <HeroSlider items={heroItems} onItemPress={handleVodPress} /> : null}

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {series.length > 0 && (
              <ContentRow
                title="أحدث المسلسلات"
                items={series.map((s) => ({ id: s.id, title: s.title, poster: s.poster, vod_type: s.vod_type, imdb_id: s.imdb_id, tmdb_id: s.tmdb_id, year: s.year, rating: s.rating }))}
                onItemPress={handleVodPress}
                onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'tv' } })}
                showBadge
              />
            )}
            {movies.length > 0 && (
              <ContentRow
                title="أحدث الأفلام"
                items={movies.map((m) => ({ id: m.id, title: m.title, poster: m.poster, vod_type: m.vod_type, imdb_id: m.imdb_id, tmdb_id: m.tmdb_id, year: m.year, rating: m.rating }))}
                onItemPress={handleVodPress}
                onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie' } })}
                showBadge
              />
            )}
          </>
        )}

        {channels.length > 0 && <View style={styles.liveSection}>
          <View style={styles.liveTitleRow}>
            <View style={styles.liveTitleLeft}>
              <View style={styles.liveAccentBar} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>البث المباشر</Text>
              <View style={styles.liveDot} />
            </View>
            <TouchableOpacity onPress={() => router.push('/live')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.seeAllText}>المزيد</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelList}>
            {channels.map((ch) => (
              <TouchableOpacity
                key={ch.id}
                style={[styles.channelCard, { backgroundColor: colors.cardBackground }]}
                onPress={() => router.push({ pathname: '/player', params: { freeChannelId: ch.id, title: ch.name } })}
                activeOpacity={0.75}
              >
                <View style={styles.liveIndicator}>
                  <View style={styles.liveIndicatorDot} />
                </View>
                <View style={[styles.channelLogoWrap, { backgroundColor: colors.inputBackground }]}>
                  {ch.logo && !logoErrors.has(ch.id) ? (
                    <Image source={{ uri: ch.logo }} style={styles.channelLogo} resizeMode="contain"
                      onError={() => setLogoErrors(p => new Set(p).add(ch.id))} />
                  ) : (
                    <Ionicons name="radio-outline" size={22} color={Colors.brand.primary} />
                  )}
                </View>
                <Text style={[styles.channelName, { color: colors.text }]} numberOfLines={1}>{ch.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>}

        {trending.length > 0 && (
          <ContentRow
            title="الأكثر رواجاً"
            items={trending.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))}
            onItemPress={handleVodPress}
            showBadge
          />
        )}

        {!extraLoaded && !loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {actionMovies.length > 0 && (
              <ContentRow title="أفلام أكشن" items={actionMovies.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie', category: 'action' } })} showBadge />
            )}
            {comedyMovies.length > 0 && (
              <ContentRow title="أفلام كوميدي" items={comedyMovies.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie', category: 'comedy' } })} showBadge />
            )}
            {horrorMovies.length > 0 && (
              <ContentRow title="أفلام رعب" items={horrorMovies.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie', category: 'horror' } })} showBadge />
            )}
            {animationMovies.length > 0 && (
              <ContentRow title="أفلام أنيميشن" items={animationMovies.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie', category: 'animation' } })} showBadge />
            )}
            {dramaSeries.length > 0 && (
              <ContentRow title="مسلسلات دراما" items={dramaSeries.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'tv', category: 'drama' } })} showBadge />
            )}
            {crimeSeries.length > 0 && (
              <ContentRow title="مسلسلات جريمة" items={crimeSeries.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'tv', category: 'crime' } })} showBadge />
            )}
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoText: {
    fontFamily: Colors.fonts.extraBold,
    color: Colors.brand.primary,
    fontSize: 22,
    letterSpacing: 1,
  },
  liveSection: { marginBottom: 24 },
  liveTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  liveTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveAccentBar: { width: 3, height: 17, borderRadius: 2, backgroundColor: Colors.brand.primary },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.success,
    shadowColor: Colors.brand.success, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 4,
  },
  sectionTitle: {
    fontFamily: Colors.fonts.bold,
    fontSize: 17,
  },
  seeAllText: {
    fontFamily: Colors.fonts.medium,
    fontSize: 13,
    color: Colors.brand.primary,
  },
  channelList: { paddingHorizontal: 12, gap: 8 },
  channelCard: {
    width: 110,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    paddingTop: 18,
    position: 'relative',
  },
  liveIndicator: {
    position: 'absolute', top: 7, right: 7,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: Colors.brand.success,
    shadowColor: Colors.brand.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  liveIndicatorDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: Colors.brand.success,
  },
  channelLogoWrap: {
    width: 64, height: 46, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, overflow: 'hidden',
  },
  channelLogo: { width: 60, height: 42 },
  channelName: {
    fontFamily: Colors.fonts.bold,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
});
