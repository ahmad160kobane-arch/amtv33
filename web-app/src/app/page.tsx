'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchFreeChannels, fetchLuluHome, FreeChannel, LuluItem } from '@/constants/api';
import ContentRow from '@/components/ContentRow';
import HeroSlider from '@/components/HeroSlider';
import { SkeletonRow, SkeletonHero } from '@/components/Skeleton';

function luluToContentItem(v: LuluItem) {
  return { id: v.id, title: v.title, poster: v.poster, vod_type: v.vod_type, year: v.year, rating: v.rating, source: 'lulu' };
}


export default function HomePage() {
  const router = useRouter();
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [luluMovies, setLuluMovies] = useState<LuluItem[]>([]);
  const [luluSeries, setLuluSeries] = useState<LuluItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [chData, luluData] = await Promise.all([
        fetchFreeChannels({ limit: 12 }),
        fetchLuluHome(),
      ]);
      setChannels(chData?.channels || []);
      setLuluMovies(luluData.latestMovies || []);
      setLuluSeries(luluData.latestSeries || []);
    } catch (e) {
      console.error('Home load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const heroItems = luluMovies.slice(0, 5).map(v => ({ id: v.id, title: v.title, poster: v.poster, backdrop: v.poster, vod_type: v.vod_type, year: v.year, rating: v.rating, genres: [], tmdb_id: v.id, source: 'lulu' }));

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
                  onClick={() => router.push(`/live?channelId=${ch.id}&title=${encodeURIComponent(ch.name)}`)}
                  className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden relative group card-hover bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border"
                >
                  <div className="absolute inset-0 flex items-center justify-center p-3">
                    {ch.logo && !logoErrors.has(ch.id) ? (
                      <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain"
                        onError={() => setLogoErrors(p => new Set(p).add(ch.id))} />
                    ) : (
                      <svg className="w-8 h-8 text-brand-primary opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      </svg>
                    )}
                  </div>
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 live-dot" />
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
          </>
        ) : (
          <>
            {luluMovies.length > 0 && (
              <ContentRow title="أحدث الأفلام" items={luluMovies.map(luluToContentItem)} seeAllHref="/allcontent?type=movie" showBadge />
            )}
            {luluSeries.length > 0 && (
              <ContentRow title="أحدث المسلسلات" items={luluSeries.map(luluToContentItem)} seeAllHref="/allcontent?type=series" showBadge />
            )}
          </>
        )}
      </div>
    </div>
  );
}
