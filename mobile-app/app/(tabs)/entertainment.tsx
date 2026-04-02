import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Animated,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { fetchVidsrcBrowse, fetchVidsrcHome, VidsrcItem } from '@/constants/Api';
import ContentRow from '@/components/ContentRow';
import HeroSlider from '@/components/HeroSlider';
import SkeletonRow, { SkeletonHero } from '@/components/SkeletonRow';

const HEADER_H = 50;

export default function EntertainmentScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [trending, setTrending] = useState<VidsrcItem[]>([]);
  const [latestMovies, setLatestMovies] = useState<VidsrcItem[]>([]);
  const [latestSeries, setLatestSeries] = useState<VidsrcItem[]>([]);
  const [comedyContent, setComedyContent] = useState<VidsrcItem[]>([]);
  const [dramaContent, setDramaContent] = useState<VidsrcItem[]>([]);
  const [actionContent, setActionContent] = useState<VidsrcItem[]>([]);
  const [romanceContent, setRomanceContent] = useState<VidsrcItem[]>([]);
  const [thrillerContent, setThrillerContent] = useState<VidsrcItem[]>([]);
  const [scifiContent, setScifiContent] = useState<VidsrcItem[]>([]);
  const [mysteryContent, setMysteryContent] = useState<VidsrcItem[]>([]);

  const totalHeader = HEADER_H + insets.top;
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScroll = useRef(Animated.diffClamp(scrollY, 0, HEADER_H)).current;
  const headerTranslateY = clampedScroll.interpolate({ inputRange: [0, HEADER_H], outputRange: [0, -totalHeader], extrapolate: 'clamp' });
  const headerOpacity = clampedScroll.interpolate({ inputRange: [0, HEADER_H * 0.8], outputRange: [1, 0], extrapolate: 'clamp' });

  const loadData = useCallback(async () => {
    try {
      const [homeData, moviesData, seriesData] = await Promise.all([
        fetchVidsrcHome(),
        fetchVidsrcBrowse({ type: 'movie', page: 1 }),
        fetchVidsrcBrowse({ type: 'tv', page: 1 }),
      ]);
      
      setTrending(homeData.trending || []);
      setLatestMovies(moviesData.items?.slice(0, 10) || []);
      setLatestSeries(seriesData.items?.slice(0, 10) || []);
      
      const categories = [
        { cat: 'comedy', setter: setComedyContent },
        { cat: 'drama', setter: setDramaContent },
        { cat: 'action', setter: setActionContent },
        { cat: 'romance', setter: setRomanceContent },
        { cat: 'thriller', setter: setThrillerContent },
        { cat: 'science-fiction', setter: setScifiContent },
        { cat: 'mystery', setter: setMysteryContent },
      ];
      
      await Promise.all(
        categories.map(async ({ cat, setter }) => {
          try {
            const data = await fetchVidsrcBrowse({ category: cat, page: 1 });
            setter(data.items?.slice(0, 10) || []);
          } catch {}
        })
      );
    } catch (e) {
      console.log('Load error:', e);
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

  const handleVodPress = useCallback((item: any) => {
    const type = item.vod_type === 'series' ? 'tv' : 'movie';
    router.push({ pathname: '/detail', params: { tmdbId: item.tmdb_id || item.id, type, title: item.title, poster: item.poster } });
  }, [router]);

  const heroItems = useMemo(() => trending
    .filter((v) => v.backdrop || v.poster)
    .slice(0, 6)
    .map((v) => ({ id: v.id, title: v.title, poster: v.backdrop || v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating, genres: v.genres })),
  [trending]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 6, transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>ترفيه</Text>
        <View style={styles.logoRow}>
          <Ionicons name="wifi" size={12} color={Colors.brand.primary} style={{ transform: [{ rotate: '45deg' }] }} />
          <Text style={styles.logoSmall}>MA</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.primary} />}
        contentContainerStyle={{ paddingTop: totalHeader }}
      >
        {loading && heroItems.length === 0 ? <SkeletonHero /> : heroItems.length > 0 ? <HeroSlider items={heroItems} onItemPress={handleVodPress} /> : null}

        {loading ? (
          <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
        ) : (
          <>
            {latestMovies.length > 0 && (<ContentRow title="أحدث الأفلام" items={latestMovies.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie' } })} showBadge />)}
            {latestSeries.length > 0 && (<ContentRow title="أحدث المسلسلات" items={latestSeries.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'tv' } })} showBadge />)}
            {trending.length > 0 && (<ContentRow title="الأكثر رواجاً" items={trending.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} showBadge />)}
            {comedyContent.length > 0 && (<ContentRow title="كوميدي" items={comedyContent.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { category: 'comedy' } })} showBadge />)}
            {dramaContent.length > 0 && (<ContentRow title="دراما" items={dramaContent.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { category: 'drama' } })} showBadge />)}
            {actionContent.length > 0 && (<ContentRow title="أكشن" items={actionContent.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { category: 'action' } })} showBadge />)}
            {romanceContent.length > 0 && (<ContentRow title="رومانسي" items={romanceContent.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { category: 'romance' } })} showBadge />)}
            {thrillerContent.length > 0 && (<ContentRow title="إثارة وتشويق" items={thrillerContent.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { category: 'thriller' } })} showBadge />)}
            {scifiContent.length > 0 && (<ContentRow title="خيال علمي" items={scifiContent.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { category: 'science-fiction' } })} showBadge />)}
            {mysteryContent.length > 0 && (<ContentRow title="غموض" items={mysteryContent.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { category: 'mystery' } })} showBadge />)}
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
    paddingHorizontal: 16, paddingBottom: 10, direction: 'rtl',
  },
  headerTitle: { fontFamily: Colors.fonts.extraBold, fontSize: 22, textAlign: 'right' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logoSmall: { fontFamily: Colors.fonts.extraBold, color: Colors.brand.primary, fontSize: 14 },
});
