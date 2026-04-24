'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchFreeChannels, fetchLuluHome, FreeChannel, LuluItem } from '@/constants/api';
import ContentRow from '@/components/ContentRow';
import HeroSlider from '@/components/HeroSlider';
import { SkeletonRow, SkeletonHero } from '@/components/Skeleton';
import { useAuth } from '@/context/AuthContext';
import AuthPrompt from '@/components/AuthPrompt';

function luluToContentItem(v: LuluItem) {
  return { id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, year: v.year, rating: v.rating, source: 'lulu' as const };
}

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const isPremium = user?.plan === 'premium';
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [luluMovies, setLuluMovies] = useState<LuluItem[]>([]);
  const [luluSeries, setLuluSeries] = useState<LuluItem[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<LuluItem[]>([]);
  const [topRatedSeries, setTopRatedSeries] = useState<LuluItem[]>([]);
  const [genreSections, setGenreSections] = useState<Record<string, LuluItem[]>>({});

  const loadData = useCallback(async () => {
    try {
      const [chData, luluData] = await Promise.all([
        fetchFreeChannels({ limit: 12 }),
        fetchLuluHome(),
      ]);
      setChannels(chData?.channels || []);
      setLuluMovies(luluData.latestMovies || []);
      setLuluSeries(luluData.latestSeries || []);
      setTopRatedMovies(luluData.topRatedMovies || []);
      setTopRatedSeries(luluData.topRatedSeries || []);
      setGenreSections(luluData.genreSections || {});
    } catch (e) {
      console.error('Home load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadData(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroItems = [...luluMovies, ...luluSeries].slice(0, 5).map(v => ({
    id: v.id,
    title: v.title,
    poster: v.poster,
    backdrop: v.poster,
    vod_type: v.vod_type,
    year: v.year,
    rating: v.rating,
    genres: v.genre ? [v.genre] : [],
    description: '',
    source: 'lulu',
  }));

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">

      {/* Hero Slider */}
      {loading ? <SkeletonHero /> : heroItems.length > 0 && <HeroSlider items={heroItems} />}

      <div className="mt-6">

        {/* Live Channels */}
        {channels.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between px-4 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-red-500" />
                <h2 className="text-base font-bold text-light-text dark:text-dark-text">البث المباشر</h2>
                <div className="w-1.5 h-1.5 rounded-full bg-brand-success live-dot" />
              </div>
              <button onClick={() => router.push('/live')} className="text-xs font-medium text-brand-primary hover:text-brand-dark transition">
                كل القنوات
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-2">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => isPremium ? router.push(`/live?channelId=${ch.id}&title=${encodeURIComponent(ch.name)}`) : setShowAuthPrompt(true)}
                  className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden relative group card-hover bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-light-border dark:border-dark-border shadow-md"
                >
                  <div className="absolute inset-0 flex items-center justify-center p-3 bg-gradient-to-br from-gray-50/95 via-gray-100/90 to-gray-200/95 dark:from-black/60 dark:via-gray-900/50 dark:to-black/60 backdrop-blur-sm">
                    {ch.logo && !logoErrors.has(ch.id) ? (
                      <img 
                        src={ch.logo} 
                        alt={ch.name} 
                        className="w-full h-full object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] dark:drop-shadow-[0_2px_12px_rgba(255,255,255,0.3)] filter contrast-110 brightness-95"
                        onError={() => setLogoErrors(p => new Set(p).add(ch.id))} 
                      />
                    ) : (
                      <svg className="w-8 h-8 text-brand-primary opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      </svg>
                    )}
                  </div>
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 live-dot shadow-lg" />
                  {!isPremium && (
                    <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-amber-500/80 backdrop-blur-sm px-1 py-0.5 rounded-sm">
                      <svg className="w-2 h-2 text-white fill-white" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-brand-primary/10 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity" />
                </button>
              ))}
              {/* "More" button */}
              <button
                onClick={() => router.push('/live')}
                className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-light-input dark:bg-dark-input border border-dashed border-light-border dark:border-dark-border flex flex-col items-center justify-center gap-1 text-light-muted dark:text-dark-muted hover:text-brand-primary hover:border-brand-primary transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[10px] font-bold">المزيد</span>
              </button>
            </div>
            {/* Channel names below */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 mt-1.5">
              {channels.map((ch) => (
                <div key={ch.id} className="flex-shrink-0 w-20 sm:w-24 text-center">
                  <span className="text-[10px] text-light-muted dark:text-dark-muted font-medium line-clamp-1">{ch.name}</span>
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
            <SkeletonRow />
          </>
        ) : (
          <>
            {luluMovies.length > 0 && (
              <ContentRow title="أحدث الأفلام" items={luluMovies.map(luluToContentItem)} seeAllHref="/entertainment?type=movie" showBadge />
            )}
            {luluSeries.length > 0 && (
              <ContentRow title="أحدث المسلسلات" items={luluSeries.map(luluToContentItem)} seeAllHref="/entertainment?type=series" showBadge />
            )}
            {topRatedMovies.length > 0 && (
              <ContentRow title="⭐ أعلى تقييماً - أفلام" items={topRatedMovies.map(luluToContentItem)} seeAllHref="/entertainment?type=movie" showBadge />
            )}
            {topRatedSeries.length > 0 && (
              <ContentRow title="⭐ أعلى تقييماً - مسلسلات" items={topRatedSeries.map(luluToContentItem)} seeAllHref="/entertainment?type=series" showBadge />
            )}
            
            {/* Genre Sections */}
            {Object.entries(genreSections).map(([genre, items]) => {
              const genreNames: Record<string, string> = {
                'Action': '🔥 أكشن',
                'Drama': '🎭 دراما',
                'Comedy': '😂 كوميديا',
                'Horror': '👻 رعب',
                'Romance': '💕 رومانسي',
                'Thriller': '🔪 إثارة',
                'Animation': '🎨 رسوم متحركة',
                'Crime': '🕵️ جريمة',
                'Documentary': '📽️ وثائقي'
              };
              return items.length > 0 && (
                <ContentRow 
                  key={genre}
                  title={genreNames[genre] || genre} 
                  items={items.map(luluToContentItem)} 
                  seeAllHref={`/entertainment?genre=${genre}`}
                  showBadge 
                />
              );
            })}
          </>
        )}
      </div>
      {showAuthPrompt && <AuthPrompt type="premium" onClose={() => setShowAuthPrompt(false)} />}
    </div>
  );
}
