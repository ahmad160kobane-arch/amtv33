'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchIptvHome, fetchIptvCategoriesWithMovies, fetchFreeChannels, IptvVodItem, IptvCategoryWithMovies, FreeChannel } from '@/constants/api';
import ContentRow from '@/components/ContentRow';
import { SkeletonRow, SkeletonChannelCard } from '@/components/Skeleton';

function toContentItem(v: IptvVodItem) {
  return { id: v.id, title: v.name, poster: v.poster, vod_type: v.vod_type, year: v.year, rating: v.rating };
}

export default function HomePage() {
  const router = useRouter();
  const [movies, setMovies] = useState<IptvVodItem[]>([]);
  const [series, setSeries] = useState<IptvVodItem[]>([]);
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<IptvCategoryWithMovies[]>([]);
  const [extraLoaded, setExtraLoaded] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [homeData, chData] = await Promise.all([fetchIptvHome(), fetchFreeChannels({ limit: 10 })]);
      setMovies(homeData.latestMovies || []);
      setSeries(homeData.latestSeries || []);
      setChannels(chData?.channels || []);
    } catch (e) {
      console.error('Home load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExtra = useCallback(async () => {
    if (extraLoaded) return;
    try {
      const data = await fetchIptvCategoriesWithMovies(8);
      setCategories(data.categories || []);
    } catch {} finally {
      setExtraLoaded(true);
    }
  }, [extraLoaded]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (!loading) loadExtra(); }, [loading, loadExtra]);

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">
      <div className="mt-4">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {movies.length > 0 && (
              <ContentRow title="أحدث الأفلام" items={movies.map(toContentItem)} seeAllHref="/allcontent?type=movie" showBadge />
            )}
            {series.length > 0 && (
              <ContentRow title="أحدث المسلسلات" items={series.map(toContentItem)} seeAllHref="/allcontent?type=series" showBadge />
            )}
          </>
        )}

        {/* Live Channels */}
        {channels.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between px-4 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-brand-primary" />
                <h2 className="text-base font-bold text-light-text dark:text-dark-text">البث المباشر</h2>
                <div className="w-1.5 h-1.5 rounded-full bg-brand-success live-dot" />
              </div>
              <button onClick={() => router.push('/live')} className="text-xs font-medium text-brand-primary hover:text-brand-dark transition">
                المزيد
              </button>
            </div>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 pb-2">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => router.push(`/live?channelId=${ch.id}&title=${encodeURIComponent(ch.name)}`)}
                  className="w-[105px] flex-shrink-0 rounded-xl overflow-hidden relative group card-hover aspect-[2/3] bg-light-card dark:bg-dark-card"
                >
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    {ch.logo && !logoErrors.has(ch.id) ? (
                      <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain drop-shadow-lg"
                        onError={() => setLogoErrors(p => new Set(p).add(ch.id))} />
                    ) : (
                      <svg className="w-10 h-10 text-brand-primary opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      </svg>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-2 px-2">
                    <span className="text-[10px] font-bold text-white text-center block line-clamp-1">{ch.name}</span>
                  </div>
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-red-600/90 px-1.5 py-0.5 rounded-md">
                    <div className="w-1 h-1 rounded-full bg-white live-dot" />
                    <span className="text-[8px] font-bold text-white">مباشر</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Categories from Xtream VOD */}
        {!extraLoaded && !loading ? (
          <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
        ) : (
          categories.map(cat => (
            cat.items.length > 0 && (
              <ContentRow key={cat.id} title={cat.name} items={cat.items.map(toContentItem)} seeAllHref={`/allcontent?type=movie&categoryId=${cat.id}`} showBadge />
            )
          ))
        )}
      </div>
    </div>
  );
}
