"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  fetchFreeChannels,
  fetchLuluHome,
  fetchLuluGenres,
  fetchLuluList,
  FreeChannel,
  LuluItem,
} from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import ContentRow from "@/components/ContentRow";
import HeroSlider from "@/components/HeroSlider";
import { SkeletonRow, SkeletonHero } from "@/components/Skeleton";

function luluToContentItem(v: LuluItem) {
  return {
    id: v.id,
    title: v.title,
    poster: v.poster,
    vod_type: v.vod_type,
    year: v.year,
    rating: v.rating,
    source: "lulu",
  };
}

export default function HomePage() {
  const router = useRouter();
  const { isPremium, isLoggedIn, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [luluMovies, setLuluMovies] = useState<LuluItem[]>([]);
  const [luluSeries, setLuluSeries] = useState<LuluItem[]>([]);
  const [genreRows, setGenreRows] = useState<{ genre: string; items: LuluItem[] }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [chData, luluData] = await Promise.all([
        fetchFreeChannels({ limit: 12 }),
        fetchLuluHome(),
      ]);
      setChannels(chData?.channels || []);
      setLuluMovies(luluData.latestMovies || []);
      setLuluSeries(luluData.latestSeries || []);

      // جلب أفضل 4 تصنيفات وعرض محتوى لكل منها
      try {
        const genres = await fetchLuluGenres();
        const topGenres = genres.slice(0, 4);
        const genreData = await Promise.all(
          topGenres.map(async (genre) => {
            const [movieData, seriesData] = await Promise.all([
              fetchLuluList({ type: "movie", page: 1, cat: genre }),
              fetchLuluList({ type: "series", page: 1, cat: genre }),
            ]);
            const items = [
              ...(movieData.items || []).slice(0, 8),
              ...(seriesData.items || []).slice(0, 8),
            ];
            return { genre, items };
          }),
        );
        setGenreRows(genreData.filter((r) => r.items.length > 0));
      } catch {
        // لا بأس إذا فشل جلب التصنيفات
      }
    } catch (e) {
      console.error("Home load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const heroItems = luluMovies.slice(0, 5).map((v) => ({
    id: v.id,
    title: v.title,
    poster: v.poster,
    backdrop: v.poster,
    vod_type: v.vod_type,
    year: v.year,
    rating: v.rating,
    genres: [],
    tmdb_id: v.id,
    source: "lulu",
  }));

  const handleChannelClick = (ch: FreeChannel) => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/subscription?reason=login");
      return;
    }
    if (!isPremium) {
      router.push("/subscription?reason=premium");
      return;
    }
    router.push(
      `/live?channelId=${ch.id}&title=${encodeURIComponent(ch.name)}`,
    );
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">
      {/* Hero Slider */}
      {loading ? (
        <SkeletonHero />
      ) : (
        heroItems.length > 0 && <HeroSlider items={heroItems} />
      )}

      <div className="mt-6">
        {/* Live Channels */}
        {channels.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between px-4 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-red-500" />
                <h2 className="text-base font-bold text-light-text dark:text-dark-text">
                  البث المباشر
                </h2>
                <div className="w-1.5 h-1.5 rounded-full bg-brand-success live-dot" />
              </div>
              <button
                onClick={() =>
                  isPremium
                    ? router.push("/live")
                    : router.push("/subscription?reason=premium")
                }
                className="text-xs font-medium text-brand-primary hover:text-brand-dark transition"
              >
                كل القنوات
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-2">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleChannelClick(ch)}
                  className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden relative group card-hover bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border"
                >
                  <div className="absolute inset-0 flex items-center justify-center p-3">
                    {ch.logo && !logoErrors.has(ch.id) ? (
                      <img
                        src={ch.logo}
                        alt={ch.name}
                        className={`w-full h-full object-contain ${!isPremium ? "brightness-75" : ""}`}
                        onError={() =>
                          setLogoErrors((p) => new Set(p).add(ch.id))
                        }
                      />
                    ) : (
                      <svg
                        className="w-8 h-8 text-brand-primary opacity-60"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Live dot for premium / Lock for non-premium */}
                  {isPremium ? (
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 live-dot" />
                  ) : (
                    <div className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                      <svg
                        className="w-2.5 h-2.5 text-amber-400"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12 1C8.676 1 6 3.676 6 7v1H4a1 1 0 00-1 1v12a1 1 0 001 1h16a1 1 0 001-1V9a1 1 0 00-1-1h-2V7c0-3.324-2.676-6-6-6zm4 7V7a4 4 0 10-8 0v1h8zm-5 5a1 1 0 112 0v3a1 1 0 11-2 0v-3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-brand-primary/10 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity" />
                </button>
              ))}

              {/* More button */}
              <button
                onClick={() =>
                  isPremium
                    ? router.push("/live")
                    : router.push("/subscription?reason=premium")
                }
                className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-light-input dark:bg-dark-input border border-dashed border-light-border dark:border-dark-border flex flex-col items-center justify-center gap-1 text-light-muted dark:text-dark-muted hover:text-brand-primary hover:border-brand-primary transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span className="text-[10px] font-bold">المزيد</span>
              </button>
            </div>

            {/* Channel names below */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 mt-1.5">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex-shrink-0 w-20 sm:w-24 text-center"
                >
                  <span className="text-[10px] text-light-muted dark:text-dark-muted font-medium line-clamp-1">
                    {ch.name}
                  </span>
                </div>
              ))}
              <div className="flex-shrink-0 w-20 sm:w-24" />
            </div>
          </section>
        )}

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {luluMovies.length > 0 && (
              <ContentRow
                title="أحدث الأفلام"
                items={luluMovies.map(luluToContentItem)}
                seeAllHref="/allcontent?type=movie"
                showBadge
              />
            )}
            {luluSeries.length > 0 && (
              <ContentRow
                title="أحدث المسلسلات"
                items={luluSeries.map(luluToContentItem)}
                seeAllHref="/allcontent?type=series"
                showBadge
              />
            )}
            {genreRows.map((row) => (
              <ContentRow
                key={row.genre}
                title={row.genre}
                items={row.items.map(luluToContentItem)}
                seeAllHref={`/allcontent?type=movie&genre=${encodeURIComponent(row.genre)}`}
              />
            ))}
          </>
        )}

        {/* Subscription Banner for non-premium */}
        {!authLoading && !isPremium && (
          <div className="mx-4 mb-6 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/20 via-brand-primary/20 to-amber-500/20 border border-brand-primary/30 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-brand-primary"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 1C8.676 1 6 3.676 6 7v1H4a1 1 0 00-1 1v12a1 1 0 001 1h16a1 1 0 001-1V9a1 1 0 00-1-1h-2V7c0-3.324-2.676-6-6-6zm4 7V7a4 4 0 10-8 0v1h8zm-5 5a1 1 0 112 0v3a1 1 0 11-2 0v-3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-light-text dark:text-dark-text">
                    اشتراك بريميوم مطلوب
                  </p>
                  <p className="text-xs text-light-muted dark:text-dark-muted">
                    شاهد الأفلام والمسلسلات والقنوات بلا قيود
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push("/subscription")}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-brand-primary text-black text-xs font-bold hover:bg-brand-dark transition"
              >
                اشترك الآن
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
