import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Animated,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { fetchChannels, fetchVidsrcBrowse, fetchFreeChannels, Channel, VidsrcItem, FreeChannel } from '@/constants/Api';
import ContentRow from '@/components/ContentRow';
import HeroSlider from '@/components/HeroSlider';
import SkeletonRow, { SkeletonHero } from '@/components/SkeletonRow';

const HEADER_H = 50;

export default function KidsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [animeSeries, setAnimeSeries] = useState<VidsrcItem[]>([]);
  const [animationMovies, setAnimationMovies] = useState<VidsrcItem[]>([]);
  const [familyMovies, setFamilyMovies] = useState<VidsrcItem[]>([]);
  const [freeKidsChannels, setFreeKidsChannels] = useState<FreeChannel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalHeader = HEADER_H + insets.top;
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScroll = useRef(Animated.diffClamp(scrollY, 0, HEADER_H)).current;
  const headerTranslateY = clampedScroll.interpolate({ inputRange: [0, HEADER_H], outputRange: [0, -totalHeader], extrapolate: 'clamp' });
  const headerOpacity = clampedScroll.interpolate({ inputRange: [0, HEADER_H * 0.8], outputRange: [1, 0], extrapolate: 'clamp' });

  const loadData = useCallback(async () => {
    try {
      const [chData, animeSeriesData, animMovieData, familyData, freeChData] = await Promise.all([
        fetchChannels({ group: 'kid', limit: 10 }),
        fetchVidsrcBrowse({ type: 'tv', category: 'animation', page: 1 }),
        fetchVidsrcBrowse({ type: 'movie', category: 'animation', page: 1 }),
        fetchVidsrcBrowse({ type: 'movie', category: 'family', page: 1 }),
        fetchFreeChannels({ group: 'أطفال', limit: 10 }),
      ]);
      setChannels(chData.items);
      setAnimeSeries(animeSeriesData.items?.slice(0, 10) || []);
      setAnimationMovies(animMovieData.items?.slice(0, 10) || []);
      setFamilyMovies(familyData.items?.slice(0, 10) || []);
      setFreeKidsChannels(freeChData?.channels || []);
    } catch {} finally { setRefreshing(false); setLoading(false); }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => { loadData(); });
    return () => task.cancel();
  }, [loadData]);

  const kidsContent = useMemo(() => [...animeSeries, ...animationMovies, ...familyMovies], [animeSeries, animationMovies, familyMovies]);

  const heroItems = useMemo(() => kidsContent
    .filter((v) => v.backdrop || v.poster)
    .slice(0, 6)
    .map((v) => ({ id: v.id, title: v.title, poster: v.backdrop || v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating, genres: v.genres })),
  [kidsContent]);

  const handleVodPress = useCallback((item: any) => {
    const type = item.vod_type === 'series' ? 'tv' : 'movie';
    router.push({ pathname: '/detail', params: { tmdbId: item.tmdb_id || item.id, type, title: item.title, poster: item.poster } });
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 6, transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>أطفال</Text>
        <View style={styles.logoRow}>
          <Ionicons name="wifi" size={12} color={Colors.brand.primary} style={{ transform: [{ rotate: '45deg' }] }} />
          <Text style={styles.logoSmall}>MA</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.brand.primary} />}
        contentContainerStyle={{ paddingTop: totalHeader }}
      >
        {loading && heroItems.length === 0 ? <SkeletonHero /> : heroItems.length > 0 ? <HeroSlider items={heroItems} onItemPress={handleVodPress} /> : null}

        {loading && channels.length === 0 && (
          <>
            {[0, 1].map((si) => (
              <View key={si} style={styles.section}>
                <View style={[styles.sectionHeader, { flexDirection: 'row', gap: 8 }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.inputBackground }} />
                  <View style={{ width: si === 0 ? 90 : 120, height: 14, borderRadius: 7, backgroundColor: colors.inputBackground }} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelList}>
                  {[0,1,2,3,4].map((i) => (
                    <View key={i} style={[styles.channelCard, { backgroundColor: colors.cardBackground }]}>
                      <View style={[styles.chIconWrap, { backgroundColor: colors.inputBackground }]} />
                      <View style={{ width: 60, height: 9, borderRadius: 5, backgroundColor: colors.inputBackground }} />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ))}
          </>
        )}

        {channels.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveDotRow}>
                <View style={styles.liveDot} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>قنوات أطفال</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelList}>
              {channels.map((ch) => (
                <TouchableOpacity
                  key={ch.id}
                  style={[styles.channelCard, { backgroundColor: colors.cardBackground }]}
                  onPress={() => router.push({ pathname: '/detail', params: { id: ch.id, title: ch.name, channelId: ch.id, channelLogo: ch.logo, type: 'channel' } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.chLiveIndicator} />
                  {ch.logo && !logoErrors.has(ch.id) ? (
                    <Image source={{ uri: ch.logo }} style={styles.chLogo} resizeMode="contain"
                      onError={() => setLogoErrors(p => new Set(p).add(ch.id))} />
                  ) : (
                    <View style={[styles.chIconWrap, { backgroundColor: colors.inputBackground }]}>
                      <Ionicons name="radio-outline" size={22} color="#764BA2" />
                    </View>
                  )}
                  <Text style={[styles.chName, { color: colors.text }]} numberOfLines={1}>{ch.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {loading ? (
          <><SkeletonRow /><SkeletonRow /></>
        ) : (
          <>
            {animeSeries.length > 0 && (
              <ContentRow title="مسلسلات أنيميشن" items={animeSeries.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'tv', category: 'animation' } })} showBadge />
            )}
            {animationMovies.length > 0 && (
              <ContentRow title="أفلام أنيميشن" items={animationMovies.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie', category: 'animation' } })} showBadge />
            )}
            {familyMovies.length > 0 && (
              <ContentRow title="أفلام عائلية" items={familyMovies.map((v) => ({ id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, imdb_id: v.imdb_id, tmdb_id: v.tmdb_id, year: v.year, rating: v.rating }))} onItemPress={handleVodPress} onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie', category: 'family' } })} showBadge />
            )}
          </>
        )}

        {freeKidsChannels.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveDotRow}>
                <View style={styles.liveDot} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>قنوات أطفال مباشرة</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelList}>
              {freeKidsChannels.map((ch) => (
                <TouchableOpacity
                  key={ch.id}
                  style={[styles.channelCard, { backgroundColor: colors.cardBackground }]}
                  onPress={() => router.push({ pathname: '/player', params: { freeChannelId: ch.id, title: ch.name } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.chLiveIndicator} />
                  {ch.logo && !logoErrors.has(ch.id) ? (
                    <Image source={{ uri: ch.logo }} style={styles.chLogo} resizeMode="contain"
                      onError={() => setLogoErrors(p => new Set(p).add(ch.id))} />
                  ) : (
                    <View style={[styles.chIconWrap, { backgroundColor: colors.inputBackground }]}>
                      <Ionicons name="radio-outline" size={22} color="#764BA2" />
                    </View>
                  )}
                  <Text style={[styles.chName, { color: colors.text }]} numberOfLines={1}>{ch.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {channels.length === 0 && animeSeries.length === 0 && animationMovies.length === 0 && (
          <View style={styles.emptySection}>
            <Ionicons name="sparkles-outline" size={52} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا يوجد محتوى أطفال</Text>
            <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>سيظهر عند الاتصال</Text>
          </View>
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
  section: { marginTop: 14, marginBottom: 8 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 10 },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.success },
  sectionTitle: { fontFamily: Colors.fonts.bold, fontSize: 17 },
  channelList: { paddingHorizontal: 12, gap: 8 },
  channelCard: { width: 110, borderRadius: 10, padding: 12, alignItems: 'center', position: 'relative' },
  chLiveIndicator: { position: 'absolute', top: 7, right: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.success },
  chLogo: { width: 60, height: 40, marginBottom: 6 },
  chIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  chName: { fontFamily: Colors.fonts.bold, fontSize: 10, textAlign: 'center' },
  emptySection: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontFamily: Colors.fonts.medium, fontSize: 15 },
  emptySubText: { fontFamily: Colors.fonts.regular, fontSize: 12 },
});
