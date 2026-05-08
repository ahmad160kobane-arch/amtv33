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
  fetchFreeChannels,
  fetchLuluList,
  FreeChannel,
  LuluItem,
} from '@/constants/Api';
import ContentRow from '@/components/ContentRow';
import SkeletonRow from '@/components/SkeletonRow';
import LiveChannelRow from '@/components/LiveChannelRow';
import { usePremiumGuard } from '@/hooks/usePremiumGuard';

const HEADER_H = 50;

function toContentItem(v: LuluItem) {
  return {
    id: v.id,
    title: v.title,
    poster: v.poster,
    vod_type: v.vod_type,
    year: v.year,
    rating: v.rating,
    source: 'lulu',
  };
}

const KIDS_KEYWORDS = ['كرتون', 'أنيميشن', 'أنمي', 'أطفال', 'animation', 'cartoon', 'anime', 'kids'];

export default function KidsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [kidsMovies, setKidsMovies] = useState<LuluItem[]>([]);
  const [kidsSeries, setKidsSeries] = useState<LuluItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const totalHeader = HEADER_H + insets.top;
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScroll = useRef(Animated.diffClamp(scrollY, 0, HEADER_H)).current;
  const headerTranslateY = clampedScroll.interpolate({ inputRange: [0, HEADER_H], outputRange: [0, -totalHeader], extrapolate: 'clamp' });
  const headerOpacity = clampedScroll.interpolate({ inputRange: [0, HEADER_H * 0.8], outputRange: [1, 0], extrapolate: 'clamp' });

  const loadData = useCallback(async () => {
    try {
      const [chData, moviesData, seriesData] = await Promise.all([
        fetchFreeChannels({ group: 'أطفال', limit: 20 }).catch(() => ({ channels: [] })),
        fetchLuluList({ type: 'movie', search: 'كرتون' }).catch(() => ({ items: [] })),
        fetchLuluList({ type: 'series', search: 'كرتون' }).catch(() => ({ items: [] })),
      ]);
      setChannels(chData.channels || []);
      setKidsMovies((moviesData.items || []).filter((i: LuluItem) =>
        KIDS_KEYWORDS.some(kw => (i.title || '').toLowerCase().includes(kw) || (i.genre || '').toLowerCase().includes(kw))
      ));
      setKidsSeries((seriesData.items || []).filter((i: LuluItem) =>
        KIDS_KEYWORDS.some(kw => (i.title || '').toLowerCase().includes(kw) || (i.genre || '').toLowerCase().includes(kw))
      ));
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

  const guard = usePremiumGuard();

  const handleChannelPress = useCallback((ch: FreeChannel) => {
    guard.requireAuth(() => {
      router.push({ pathname: '/player', params: { premiumChannelId: ch.id, title: ch.name } });
    });
  }, [guard, router]);

  const handleVodPress = useCallback((item: any) => {
    guard.requireAuth(() => {
      const type = item.vod_type === 'series' ? 'series' : 'movie';
      router.push({
        pathname: '/detail',
        params: {
          luluId: item.id,
          vodType: type,
          source: 'lulu',
          title: item.title,
          poster: item.poster,
        },
      });
    });
  }, [guard, router]);

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

        {/* محتوى أطفال من lulu */}
        {loading ? (
          <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
        ) : (
          <>
            {kidsMovies.length > 0 && (
              <ContentRow
                title="أفلام كرتون"
                items={kidsMovies.map(toContentItem)}
                onItemPress={handleVodPress}
                onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'movie' } })}
                showBadge
              />
            )}
            {kidsSeries.length > 0 && (
              <ContentRow
                title="مسلسلات كرتون"
                items={kidsSeries.map(toContentItem)}
                onItemPress={handleVodPress}
                onSeeAll={() => router.push({ pathname: '/allcontent', params: { type: 'series' } })}
                showBadge
              />
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
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  headerTitle: { fontFamily: Colors.fonts.extraBold, fontSize: 22, textAlign: 'right' },
});
