import React, { useEffect, useState, useCallback, useRef } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FilmIcon,
  StarIcon,
  SearchIcon,
  CloseCircleIcon,
  InfoIcon,
} from "@/components/AppIcons";
import AppLogo from "@/components/AppLogo";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/hooks/useColorScheme";
import Colors from "@/constants/Colors";
import { fetchLuluList, LuluItem } from "@/constants/Api";

const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 3;
const CARD_H = CARD_W * 1.52;

const TYPES = [
  { id: "movie", label: "أفلام" },
  { id: "series", label: "مسلسلات" },
];

function SkeletonGrid({ colors }: { colors: any }) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12 }}>
      {[0, 1, 2, 3].map((row) => (
        <View
          key={row}
          style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}
        >
          {[0, 1, 2].map((col) => (
            <Animated.View
              key={col}
              style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: 12,
                backgroundColor: colors.inputBackground,
                opacity: pulse,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function EntertainmentScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeType, setActiveType] = useState<"movie" | "series">("movie");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [items, setItems] = useState<LuluItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  const load = useCallback(
    async (page: number, reset: boolean) => {
      try {
        setError("");
        const data = await fetchLuluList({
          type: activeType,
          page,
          search: searchQuery.trim() || undefined,
        });
        const newItems = data.items || [];
        if (reset) setItems(newItems);
        else setItems((prev) => [...prev, ...newItems]);
        setHasMore(data.hasMore ?? false);
        pageRef.current = page + 1;
      } catch (e: any) {
        setError(e?.message || "خطأ في التحميل");
      } finally {
        setLoading(false);
        setRefreshing(false);
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    },
    [activeType, searchQuery],
  );

  useEffect(() => {
    setItems([]);
    setLoading(true);
    setHasMore(true);
    pageRef.current = 1;
    load(1, true);
  }, [activeType, searchQuery, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setItems([]);
    pageRef.current = 1;
    load(1, true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    load(pageRef.current, false);
  }, [hasMore, load]);

  const handleSearch = useCallback(() => {
    setSearchQuery(search);
  }, [search]);

  const handlePress = useCallback(
    (item: LuluItem) => {
      const type = item.vod_type === "series" ? "series" : "movie";
      router.push({
        pathname: "/detail",
        params: {
          luluId: item.id,
          vodType: type,
          source: "lulu",
          title: item.title,
          poster: item.poster,
        },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: LuluItem }) => {
      const ratingVal = item.rating ? parseFloat(item.rating) : 0;
      const isSeries = item.vod_type === "series";
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => handlePress(item)}
          activeOpacity={0.75}
        >
          {item.poster ? (
            <Image
              source={{ uri: item.poster }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.noPoster,
                { backgroundColor: colors.inputBackground },
              ]}
            >
              <FilmIcon size={24} color={colors.textSecondary} />
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.9)"]}
            locations={[0.38, 0.68, 1]}
            style={styles.gradient}
          />
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isSeries
                  ? "rgba(99,102,241,0.92)"
                  : "rgba(255,184,0,0.92)",
              },
            ]}
          >
            <Text style={styles.badgeText}>{isSeries ? "مسلسل" : "فيلم"}</Text>
          </View>
          {ratingVal > 0 && (
            <View style={styles.ratingBadge}>
              <StarIcon size={8} color="#FFB800" />
              <Text style={styles.ratingText}>{ratingVal.toFixed(1)}</Text>
            </View>
          )}
          <View style={styles.cardBottom}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.year ? (
              <Text style={styles.cardYear}>{item.year}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [handlePress, colors.inputBackground, colors.textSecondary],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 6, backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>استكشف</Text>
        <AppLogo size="sm" />
      </View>

      {/* Search + Type filter */}
      <View style={styles.searchFilterRow}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.inputBackground },
          ]}
        >
          <SearchIcon size={14} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="بحث..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            textAlign="right"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch("");
                setSearchQuery("");
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <CloseCircleIcon size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.typeBtn,
              activeType === t.id && styles.typeBtnActive,
            ]}
            onPress={() => {
              setActiveType(t.id as "movie" | "series");
              setSearchQuery("");
              setSearch("");
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.typeBtnText,
                { color: activeType === t.id ? "#000" : colors.textSecondary },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {error ? (
        <View style={styles.errorBox}>
          <InfoIcon size={32} color="#e74c3c" />
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error}
          </Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <SkeletonGrid colors={colors} />
      ) : items.length === 0 ? (
        <View style={styles.errorBox}>
          <FilmIcon size={40} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            لا توجد نتائج
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}_${index}`}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={9}
          windowSize={5}
          initialNumToRender={12}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.brand.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.brand.primary} />
                <Text
                  style={[styles.footerText, { color: colors.textSecondary }]}
                >
                  جاري التحميل...
                </Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontFamily: Colors.fonts.extraBold,
    fontSize: 22,
    textAlign: "right",
  },
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: Colors.fonts.regular,
    fontSize: 13,
    paddingVertical: 0,
    textAlign: "right",
    writingDirection: "rtl",
  },
  typeBtn: {
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  typeBtnActive: { backgroundColor: Colors.brand.primary },
  typeBtnText: { fontFamily: Colors.fonts.bold, fontSize: 12 },
  catRow: { paddingHorizontal: 12, gap: 6, paddingBottom: 8 },
  catChip: {
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  catChipActive: {
    backgroundColor: "rgba(255,184,0,0.12)",
    borderColor: "rgba(255,184,0,0.35)",
  },
  catChipText: { fontFamily: Colors.fonts.medium, fontSize: 11 },
  grid: { paddingHorizontal: 12, paddingBottom: 30 },
  row: { justifyContent: "flex-start", gap: 8, marginBottom: 10 },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  errorText: {
    fontFamily: Colors.fonts.regular,
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: { fontFamily: Colors.fonts.bold, fontSize: 14, color: "#000" },
  card: { width: CARD_W, height: CARD_H, borderRadius: 12, overflow: "hidden" },
  poster: { width: "100%", height: "100%", position: "absolute" },
  noPoster: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "68%",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: Colors.fonts.bold,
    color: "#fff",
    fontSize: 9,
    letterSpacing: 0.3,
  },
  ratingBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.68)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: { fontFamily: Colors.fonts.bold, color: "#FFB800", fontSize: 9 },
  cardBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 7,
    paddingBottom: 8,
  },
  cardTitle: {
    fontFamily: Colors.fonts.bold,
    color: "#fff",
    fontSize: 10,
    textAlign: "right",
    lineHeight: 14,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardYear: {
    fontFamily: Colors.fonts.regular,
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    textAlign: "right",
    marginTop: 2,
  },
  footerLoader: { alignItems: "center", paddingVertical: 20, gap: 6 },
  footerText: { fontFamily: Colors.fonts.regular, fontSize: 12 },
});
