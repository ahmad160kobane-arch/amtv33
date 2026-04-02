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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import { fetchFreeChannels, FreeChannel } from '@/constants/Api';

const { width } = Dimensions.get('window');
const CARD_W = (width - 40) / 2;
const PAGE_SIZE = 30;

function SkeletonChannels({ colors }: { colors: any }) {
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
  const bg = colors.cardBackground;
  const shimmer = colors.inputBackground;
  return (
    <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 4 }}>
      {[0, 1, 2, 3, 4].map((row) => (
        <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          {[0, 1].map((col) => (
            <Animated.View key={col} style={{ width: CARD_W, borderRadius: 14, minHeight: 140, backgroundColor: shimmer, opacity: pulse, alignItems: 'center', justifyContent: 'center', padding: 14 }}>
              <View style={{ width: 72, height: 52, borderRadius: 10, backgroundColor: bg, marginBottom: 10 }} />
              <View style={{ width: CARD_W * 0.65, height: 11, borderRadius: 6, backgroundColor: bg, marginBottom: 8 }} />
              <View style={{ width: CARD_W * 0.45, height: 9, borderRadius: 5, backgroundColor: bg }} />
            </Animated.View>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function LiveScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

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
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.cardBackground }]}
      onPress={() => router.push({ pathname: '/player', params: { freeChannelId: item.id, title: item.name } })}
      activeOpacity={0.75}
    >
      <View style={[styles.livePill]}>
        <View style={styles.liveDot} />
        <Text style={styles.livePillText}>مباشر</Text>
      </View>
      <View style={[styles.logoWrap, { backgroundColor: colors.inputBackground }]}>
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={styles.logo} resizeMode="contain" />
        ) : (
          <Ionicons name="radio-outline" size={30} color={Colors.brand.primary} />
        )}
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
      {item.group ? (
        <View style={[styles.groupChip, { backgroundColor: colors.inputBackground }]}>
          <Text style={[styles.group, { color: colors.textSecondary }]} numberOfLines={1}>{item.group}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  ), [colors.cardBackground, colors.inputBackground, colors.textSecondary, colors.text, router]);

  const renderCategory = useCallback(({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.categoryChip,
        { 
          backgroundColor: selectedCategory === item ? Colors.brand.primary : colors.cardBackground,
          borderColor: selectedCategory === item ? Colors.brand.primary : colors.cardBorder,
        }
      ]}
      onPress={() => setSelectedCategory(prev => prev === item ? '' : item)}
    >
      <Text style={[
        styles.categoryText,
        { color: selectedCategory === item ? '#fff' : colors.text }
      ]} numberOfLines={1}>
        {item}
      </Text>
    </TouchableOpacity>
  ), [selectedCategory, colors.cardBackground, colors.cardBorder, colors.text]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="radio" size={18} color={Colors.brand.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>البث المباشر ({total})</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
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
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      {categories.length > 0 && (
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
          style={styles.categoriesList}
        />
      )}

      {/* Channels */}
      {loading ? (
        <SkeletonChannels colors={colors} />
      ) : (
        <FlatList
          data={channels}
          renderItem={renderChannel}
          keyExtractor={(item, index) => `${item.id}_${index}`}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={10}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} tintColor={Colors.brand.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={Colors.brand.primary} />
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>جاري التحميل...</Text>
            </View>
          ) : null}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Ionicons name="tv-outline" size={60} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا توجد قنوات</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, direction: 'rtl',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontFamily: Colors.fonts.bold, fontSize: 18, textAlign: 'right' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 8, direction: 'rtl',
  },
  searchInput: { flex: 1, fontFamily: Colors.fonts.regular, fontSize: 14, textAlign: 'right' },
  categoriesList: { maxHeight: 44, marginBottom: 8 },
  categoriesContainer: { paddingHorizontal: 16, gap: 8 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8,
  },
  categoryText: { fontFamily: Colors.fonts.medium, fontSize: 12 },
  grid: { paddingHorizontal: 12, paddingBottom: 30 },
  row: { justifyContent: 'space-between', marginBottom: 12 },
  card: {
    width: CARD_W, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    padding: 14, paddingTop: 28, position: 'relative', minHeight: 140,
  },
  livePill: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(52,199,89,0.12)', borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.brand.success },
  livePillText: { fontFamily: Colors.fonts.bold, fontSize: 9, color: Colors.brand.success },
  logoWrap: {
    width: 72, height: 52, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, overflow: 'hidden',
  },
  logo: { width: 68, height: 48 },
  name: { fontFamily: Colors.fonts.bold, fontSize: 11, textAlign: 'center', marginBottom: 6, lineHeight: 16 },
  groupChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  group: { fontFamily: Colors.fonts.regular, fontSize: 9, textAlign: 'center' },
  footerLoader: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  footerText: { fontFamily: Colors.fonts.regular, fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyText: { fontFamily: Colors.fonts.medium, fontSize: 15 },
});
