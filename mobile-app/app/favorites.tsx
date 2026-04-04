import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, RefreshControl, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowBackIcon, PersonIcon, BookmarkIcon, FilmIcon, TvIcon } from '@/components/AppIcons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { VodItem, Channel, apiFetch, isLoggedIn } from '@/constants/Api';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 3;

function SkeletonFavorites({ colors }: { colors: any }) {
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
            <Animated.View key={col} style={{ width: CARD_W, height: CARD_W * 1.52, borderRadius: 12, backgroundColor: colors.inputBackground, opacity: pulse }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function FavoritesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [vodFavs, setVodFavs] = useState<VodItem[]>([]);
  const [chFavs, setChFavs] = useState<Channel[]>([]);
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
      setChFavs(data.channels || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePress = useCallback((item: any) => {
    router.push({ pathname: '/detail', params: { xtreamId: item.id, vodType: item.content_type === 'series' || item.content_type === 'tv' ? 'series' : 'movie', title: item.title || '', poster: item.poster || '' } });
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowBackIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>قائمتي</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <SkeletonFavorites colors={colors} />
      ) : !loggedIn ? (
        <View style={styles.center}>
          <PersonIcon size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>سجل الدخول لعرض مفضلاتك</Text>
        </View>
      ) : vodFavs.length === 0 && chFavs.length === 0 ? (
        <View style={styles.center}>
          <BookmarkIcon size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا يوجد محتوى محفوظ</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.brand.primary} />}>
          {vodFavs.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>أفلام ومسلسلات</Text>
              <View style={styles.gridWrap}>
                {vodFavs.map((item: any) => (
                  <TouchableOpacity key={item.id} style={styles.card} onPress={() => handlePress(item)} activeOpacity={0.75}>
                    {item.poster ? (
                      <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
                    ) : (
                      <View style={[styles.noPoster, { backgroundColor: colors.inputBackground }]}>
                        <FilmIcon size={24} color={colors.textSecondary} />
                      </View>
                    )}
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']} locations={[0.38, 0.68, 1]} style={styles.gradient} />
                    <View style={[styles.typeBadge, { backgroundColor: item.content_type === 'movie' ? 'rgba(255,184,0,0.92)' : 'rgba(99,102,241,0.92)' }]}>
                      <Text style={styles.typeBadgeText}>{item.content_type === 'movie' ? 'فيلم' : 'مسلسل'}</Text>
                    </View>
                    <View style={styles.cardBottom}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {chFavs.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>القنوات</Text>
              <View style={styles.gridWrap}>
                {chFavs.map((ch: any) => (
                  <TouchableOpacity key={ch.id} style={[styles.card, { backgroundColor: colors.cardBackground }]}
                    onPress={() => router.push({ pathname: '/player', params: { channelId: ch.id, title: ch.name } } as any)} activeOpacity={0.75}>
                    <View style={styles.chLiveDot} />
                    <View style={[styles.chLogoWrap, { backgroundColor: colors.inputBackground }]}>
                      {ch.logo ? (
                        <Image source={{ uri: ch.logo }} style={styles.chLogo} resizeMode="contain" />
                      ) : (
                        <TvIcon size={26} color={Colors.brand.primary} />
                      )}
                    </View>
                    <Text style={[styles.chName, { color: colors.text }]} numberOfLines={2}>{ch.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
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
  headerTitle: { fontFamily: Colors.fonts.bold, fontSize: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: Colors.fonts.medium, fontSize: 15 },
  grid: { paddingHorizontal: 12, paddingBottom: 30 },
  sectionTitle: { fontFamily: Colors.fonts.bold, fontSize: 14, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '31%', aspectRatio: 2 / 3, borderRadius: 12, overflow: 'hidden' },
  poster: { width: '100%', height: '100%', position: 'absolute' },
  noPoster: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '68%' },
  typeBadge: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  typeBadgeText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 9 },
  cardBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6, paddingBottom: 7 },
  cardTitle: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 10, textAlign: 'right', lineHeight: 14, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  chLiveDot: { position: 'absolute', top: 6, right: 6, zIndex: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.success },
  chLogoWrap: { width: '100%', aspectRatio: 1.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10, overflow: 'hidden' },
  chLogo: { width: '90%', height: '90%' },
  chName: { fontFamily: Colors.fonts.bold, fontSize: 9, textAlign: 'center', padding: 5, lineHeight: 13 },
});
