import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Share,
} from "react-native";
import {
  PlayIcon,
  ArrowBackIcon,
  HeartIcon,
  ShareIcon,
  StarIcon,
  FilmIcon,
  LockPremiumIcon,
} from "@/components/AppIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "@/hooks/useColorScheme";
import Colors from "@/constants/Colors";
import {
  fetchLuluDetail,
  requestLuluStream,
  LuluDetail,
  LuluEpisode,
  LuluSeason,
  isLoggedIn as apiIsLoggedIn,
  checkFavorite,
  toggleFavorite,
} from "@/constants/Api";
import { useAuth } from "@/context/AuthContext";
import { usePremiumGuard } from "@/hooks/usePremiumGuard";

const { width: SCREEN_W } = Dimensions.get("window");
const BACKDROP_H = SCREEN_W * 0.58;

export default function DetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    luluId?: string;
    source?: string;
    vodType?: string;
    title?: string;
    poster?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<LuluDetail | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [backdropError, setBackdropError] = useState(false);
  const { isPremium, isLoggedIn, loading: authLoading } = useAuth();
  const guard = usePremiumGuard();

  const contentId = params.luluId || "";
  const isSeries = params.vodType === "series" || params.vodType === "tv";
  const luluType = isSeries ? "series" : "movie";

  const loadData = useCallback(async () => {
    try {
      if (!contentId) return;
      const data = await fetchLuluDetail(contentId, luluType);
      setDetail(data);
      if (data && isSeries) {
        const seasons = data.seasons || [];
        if (seasons.length > 0) setSelectedSeason(seasons[0].season);
      }
      const loggedIn = await apiIsLoggedIn();
      if (loggedIn) {
        const fav = await checkFavorite(contentId, "vod");
        setIsFav(fav);
      }
    } catch (e) {
      console.log("[Detail] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [contentId, isSeries, luluType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleFav = async () => {
    if (favLoading) return;
    const loggedIn = await apiIsLoggedIn();
    if (!loggedIn) {
      router.push("/account" as any);
      return;
    }
    setFavLoading(true);
    try {
      const favTitle = detail?.title || params.title;
      const favPoster = detail?.poster || params.poster;
      const result = await toggleFavorite(contentId, "vod", {
        title: favTitle,
        poster: favPoster,
        content_type: luluType,
      });
      if (result) setIsFav(!isFav);
    } catch {
    } finally {
      setFavLoading(false);
    }
  };

  const handlePlayMovie = () => {
    guard.requireAuth(() => {
      const ld = detail as LuluDetail;
      const embedUrl = ld?.embedUrl || "";
      const hlsUrl = ld?.hlsUrl || "";
      const fileCode = ld?.fileCode || ld?.id || contentId;
      if (embedUrl) {
        router.push({
          pathname: "/player",
          params: { embedUrl, title, isEmbed: "1" },
        } as any);
      } else if (hlsUrl) {
        router.push({
          pathname: "/player",
          params: { luluHls: hlsUrl, title, luluType: "movie" },
        } as any);
      } else {
        router.push({
          pathname: "/player",
          params: { luluId: fileCode, luluType: "movie", title },
        } as any);
      }
    });
  };

  const handlePlayEpisode = (ep: LuluEpisode) => {
    guard.requireAuth(() => {
      const embedUrl = ep.embedUrl || "";
      const hlsUrl = ep.hlsUrl || "";
      if (embedUrl) {
        router.push({
          pathname: "/player",
          params: {
            embedUrl,
            title: `${title} - ${ep.title || `الحلقة ${ep.episode}`}`,
            isEmbed: "1",
          },
        } as any);
      } else if (hlsUrl) {
        router.push({
          pathname: "/player",
          params: {
            luluHls: hlsUrl,
            title: `${title} - ${ep.title || `الحلقة ${ep.episode}`}`,
            luluType: "series",
          },
        } as any);
      }
    });
  };

  const handleShare = async () => {
    const name = detail?.title || params.title || "";
    Share.share({ message: `شاهد "${name}" على تطبيق MA` });
  };

  const backdropUri = detail?.backdrop || detail?.poster || params.poster || "";
  const posterUri = detail?.poster || params.poster || "";
  const title = detail?.title || params.title || "";
  const description = detail?.plot || "";
  const genresText = detail?.genres || detail?.genre || "";
  const castText = detail?.cast_list || "";
  const directorText = detail?.director || "";
  const countryText = detail?.country || "";
  const runtimeText = detail?.runtime || "";

  // Episodes
  let seasons: number[] = [];
  let episodes: LuluEpisode[] = [];
  if (isSeries && detail) {
    const ld = detail as LuluDetail;
    seasons = (ld.seasons || []).map((s) => s.season);
    episodes = (ld.seasons || [])
      .filter((s) => s.season === selectedSeason)
      .flatMap((s) => s.episodes || []);
  }

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          جاري التحميل...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Backdrop */}
        <View style={{ height: BACKDROP_H }}>
          {backdropUri && !backdropError ? (
            <Image
              source={{ uri: backdropUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
              onError={() => setBackdropError(true)}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: colors.cardBackground },
              ]}
            />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.5)", colors.background]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + 8 }]}
          >
            <ArrowBackIcon size={22} color="#fff" />
          </TouchableOpacity>
          {/* Action buttons */}
          <View style={[styles.topActions, { top: insets.top + 8 }]}>
            <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
              <ShareIcon size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleToggleFav}
              style={styles.actionBtn}
            >
              <HeartIcon
                size={20}
                color={isFav ? "#e74c3c" : "#fff"}
                filled={isFav}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info section */}
        <View style={styles.infoSection}>
          <View style={styles.posterRow}>
            <View style={styles.posterWrapper}>
              {posterUri && !posterError ? (
                <Image
                  source={{ uri: posterUri }}
                  style={styles.poster}
                  resizeMode="cover"
                  onError={() => setPosterError(true)}
                />
              ) : (
                <LinearGradient
                  colors={["rgba(100,100,120,0.3)", "rgba(60,60,80,0.5)"]}
                  style={[
                    styles.poster,
                    { alignItems: "center", justifyContent: "center" },
                  ]}
                >
                  <FilmIcon size={32} color={colors.textSecondary} />
                </LinearGradient>
              )}
            </View>
            <View style={styles.titleBlock}>
              <Text
                style={[
                  styles.title,
                  { color: colors.text, writingDirection: "rtl" },
                ]}
                numberOfLines={3}
              >
                {title}
              </Text>
              {/* Meta row */}
              <View style={styles.metaRow}>
                {detail?.year ? (
                  <View
                    style={[
                      styles.metaPill,
                      { backgroundColor: colors.cardBackground },
                    ]}
                  >
                    <Text
                      style={[styles.metaText, { color: colors.textSecondary }]}
                    >
                      {detail.year}
                    </Text>
                  </View>
                ) : null}
                {detail?.rating ? (
                  <View
                    style={[
                      styles.metaPill,
                      {
                        backgroundColor: colors.cardBackground,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      },
                    ]}
                  >
                    <StarIcon size={10} color="#FFB800" />
                    <Text style={[styles.metaText, { color: "#FFB800" }]}>
                      {parseFloat(detail.rating).toFixed(1)}
                    </Text>
                  </View>
                ) : null}
                {detail?.runtime ? (
                  <View
                    style={[
                      styles.metaPill,
                      { backgroundColor: colors.cardBackground },
                    ]}
                  >
                    <Text
                      style={[styles.metaText, { color: colors.textSecondary }]}
                    >
                      {detail.runtime}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.metaPill,
                    {
                      backgroundColor: isSeries
                        ? "rgba(99,102,241,0.2)"
                        : "rgba(255,184,0,0.2)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.metaText,
                      { color: isSeries ? "#818cf8" : "#FFB800" },
                    ]}
                  >
                    {isSeries ? "مسلسل" : "فيلم"}
                  </Text>
                </View>
              </View>
              {/* Genre */}
              {genresText ? (
                <Text
                  style={[
                    styles.genreText,
                    { color: colors.textSecondary, writingDirection: "rtl" },
                  ]}
                  numberOfLines={1}
                >
                  {genresText}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Plot / Description */}
          {description ? (
            <View style={styles.plotSection}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.text, writingDirection: "rtl" },
                ]}
              >
                القصة
              </Text>
              <Text
                style={[
                  styles.plotText,
                  { color: colors.textSecondary, writingDirection: "rtl" },
                ]}
              >
                {description}
              </Text>
            </View>
          ) : null}

          {/* Cast & Director & Country */}
          {castText || directorText || countryText ? (
            <View style={styles.creditsSection}>
              {directorText ? (
                <View style={styles.creditRow}>
                  <Text
                    style={[
                      styles.creditLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    المخرج:{" "}
                  </Text>
                  <Text
                    style={[styles.creditValue, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {directorText}
                  </Text>
                </View>
              ) : null}
              {castText ? (
                <View style={styles.creditRow}>
                  <Text
                    style={[
                      styles.creditLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    الممثلون:{" "}
                  </Text>
                  <Text
                    style={[styles.creditValue, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {castText}
                  </Text>
                </View>
              ) : null}
              {countryText ? (
                <View style={styles.creditRow}>
                  <Text
                    style={[
                      styles.creditLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    البلد:{" "}
                  </Text>
                  <Text
                    style={[styles.creditValue, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {countryText}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Play button for movies */}
          {!isSeries && (
            <TouchableOpacity
              style={styles.playBtn}
              onPress={handlePlayMovie}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={isPremium ? Colors.brand.gradient : ['#555', '#444'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.playBtnGradient}
              >
                {isPremium ? (
                  <PlayIcon size={18} color="#000" />
                ) : (
                  <LockPremiumIcon size={18} color="#FFB800" />
                )}
                <Text style={[styles.playBtnText, !isPremium && { color: '#FFB800' }]}>
                  {isPremium ? 'تشغيل الفيلم' : 'اشترك للمشاهدة'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Series: Season selector + Episodes */}
          {isSeries && seasons.length > 0 && (
            <>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.text, marginTop: 20 },
                ]}
              >
                المواسم والحلقات
              </Text>

              {/* Season tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.seasonsRow}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
              >
                {seasons.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.seasonTab,
                      {
                        backgroundColor:
                          selectedSeason === s
                            ? Colors.brand.primary
                            : colors.cardBackground,
                      },
                    ]}
                    onPress={() => setSelectedSeason(s)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.seasonTabText,
                        { color: selectedSeason === s ? "#000" : colors.text },
                      ]}
                    >
                      موسم {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Episodes list */}
              <View style={styles.episodesList}>
                {episodes.map((ep, idx) => (
                  <TouchableOpacity
                    key={ep.id || `${ep.season}_${ep.episode}_${idx}`}
                    style={[
                      styles.episodeRow,
                      { backgroundColor: colors.cardBackground },
                    ]}
                    onPress={() => handlePlayEpisode(ep)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.epInfo}>
                      <Text
                        style={[
                          styles.epTitle,
                          { color: colors.text, writingDirection: "rtl" },
                        ]}
                        numberOfLines={2}
                      >
                        {ep.episode}. {ep.title || `الحلقة ${ep.episode}`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.playCircle,
                        { backgroundColor: Colors.brand.primary },
                      ]}
                    >
                      <PlayIcon size={12} color="#000" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontFamily: Colors.fonts.regular, fontSize: 14 },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  topActions: { position: "absolute", right: 16, flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoSection: { paddingHorizontal: 16, paddingTop: 12 },
  posterRow: { flexDirection: "row", gap: 14, marginBottom: 16 },
  posterWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  poster: { width: 110, height: 165, borderRadius: 12 },
  titleBlock: { flex: 1, justifyContent: "center", gap: 8 },
  title: {
    fontFamily: Colors.fonts.extraBold,
    fontSize: 20,
    textAlign: "right",
    lineHeight: 28,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaText: { fontFamily: Colors.fonts.bold, fontSize: 11 },
  genreText: {
    fontFamily: Colors.fonts.regular,
    fontSize: 12,
    textAlign: "right",
  },
  plotSection: { marginBottom: 16 },
  sectionLabel: {
    fontFamily: Colors.fonts.bold,
    fontSize: 16,
    textAlign: "right",
    marginBottom: 8,
  },
  plotText: {
    fontFamily: Colors.fonts.regular,
    fontSize: 13.5,
    lineHeight: 22,
    textAlign: "right",
  },
  creditsSection: { marginBottom: 18, gap: 6 },
  creditRow: { flexDirection: "row", flexWrap: "wrap" },
  creditLabel: { fontFamily: Colors.fonts.bold, fontSize: 13 },
  creditValue: {
    fontFamily: Colors.fonts.regular,
    fontSize: 13,
    flex: 1,
    textAlign: "right",
  },
  playBtn: {
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  playBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  playBtnText: { fontFamily: Colors.fonts.bold, fontSize: 16, color: "#000" },
  seasonsRow: { marginBottom: 14 },
  seasonTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  seasonTabText: { fontFamily: Colors.fonts.bold, fontSize: 13 },
  episodesList: { gap: 10, marginBottom: 16 },
  episodeRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    overflow: "hidden",
    gap: 12,
    paddingLeft: 12,
    paddingVertical: 12,
  },
  epInfo: { flex: 1 },
  epTitle: {
    fontFamily: Colors.fonts.bold,
    fontSize: 13,
    textAlign: "right",
    marginBottom: 4,
  },
  playCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
