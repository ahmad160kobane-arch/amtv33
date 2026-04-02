import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
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
import { fetchChannels, fetchFreeChannels, Channel, FreeChannel } from '@/constants/Api';

const HEADER_H = 50;

export default function SportsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [freeSportsChannels, setFreeSportsChannels] = useState<FreeChannel[]>([]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());

  const totalHeader = HEADER_H + insets.top;
  const scrollY = useRef(new Animated.Value(0)).current;
  const clampedScroll = useRef(Animated.diffClamp(scrollY, 0, HEADER_H)).current;
  const headerTranslateY = clampedScroll.interpolate({ inputRange: [0, HEADER_H], outputRange: [0, -totalHeader], extrapolate: 'clamp' });
  const headerOpacity = clampedScroll.interpolate({ inputRange: [0, HEADER_H * 0.8], outputRange: [1, 0], extrapolate: 'clamp' });

  const loadData = useCallback(async () => {
    try {
      const [chData, freeChData] = await Promise.all([
        fetchChannels({ group: 'sport', limit: 20 }),
        fetchFreeChannels({ group: 'رياضة', limit: 20 }),
      ]);
      
      setChannels(chData.items || []);
      setFreeSportsChannels(freeChData?.channels || []);
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.header, { backgroundColor: colors.background, paddingTop: insets.top + 6, transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>رياضة</Text>
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
        {loading && (
          <>
            {[0, 1].map((si) => (
              <View key={si} style={styles.section}>
                <View style={[styles.sectionHeader, { flexDirection: 'row', gap: 8 }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.inputBackground }} />
                  <View style={{ width: si === 0 ? 110 : 140, height: 14, borderRadius: 7, backgroundColor: colors.inputBackground }} />
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

        {!loading && channels.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveDotRow}>
                <View style={styles.liveDot} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>قنوات رياضية</Text>
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
                      <Ionicons name="football-outline" size={22} color={Colors.brand.primary} />
                    </View>
                  )}
                  <Text style={[styles.chName, { color: colors.text }]} numberOfLines={1}>{ch.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {!loading && freeSportsChannels.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveDotRow}>
                <View style={styles.liveDot} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>بث رياضي مباشر</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.channelList}>
              {freeSportsChannels.map((ch) => (
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
                      <Ionicons name="radio-outline" size={22} color={Colors.brand.primary} />
                    </View>
                  )}
                  <Text style={[styles.chName, { color: colors.text }]} numberOfLines={1}>{ch.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {!loading && channels.length === 0 && freeSportsChannels.length === 0 && (
          <View style={styles.emptySection}>
            <Ionicons name="football-outline" size={52} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا يوجد محتوى رياضي</Text>
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
});
