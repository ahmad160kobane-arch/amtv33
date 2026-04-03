'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchVidsrcHome, fetchFreeChannels, fetchVidsrcBrowse, VidsrcItem, FreeChannel } from '@/constants/api';
import HeroSlider from '@/components/HeroSlider';
import ContentRow from '@/components/ContentRow';
import { SkeletonHero, SkeletonRow, SkeletonChannelCard } from '@/components/Skeleton';

export default function HomePage() {
  const router = useRouter();
  const [movies, setMovies] = useState<VidsrcItem[]>([]);
  const [series, setSeries] = useState<VidsrcItem[]>([]);
  const [trending, setTrending] = useState<VidsrcItem[]>([]);
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [popularMovies, setPopularMovies] = useState<VidsrcItem[]>([]);
  const [popularSeries, setPopularSeries] = useState<VidsrcItem[]>([]);
  const [actionMovies, setActionMovies] = useState<VidsrcItem[]>([]);
  const [comedyMovies, setComedyMovies] = useState<VidsrcItem[]>([]);
  const [horrorMovies, setHorrorMovies] = useState<VidsrcItem[]>([]);
  const [animationMovies, setAnimationMovies] = useState<VidsrcItem[]>([]);
  const [dramaSeries, setDramaSeries] = useState<VidsrcItem[]>([]);
  const [crimeSeries, setCrimeSeries] = useState<VidsrcItem[]>([]);
  const [extraLoaded, setExtraLoaded] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [homeData, chData] = await Promise.all([fetchVidsrcHome(), fetchFreeChannels({ limit: 10 })]);
      setMovies(homeData.latestMovies || []);
      setSeries(homeData.latestTvShows || []);
      setTrending(homeData.trending || []);
      setPopularMovies(homeData.popularMovies || []);
      setPopularSeries(homeData.popularTvShows || []);
      setChannels(chData?.channels || []);
    } catch (e) {
      console.error('Home load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExtra = useCallback(async () => {
    if (extraLoaded) return;
    await Promise.all([
      fetchVidsrcBrowse({ type: 'movie', category: 'action', page: 1 }).then(d => setActionMovies(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'movie', category: 'comedy', page: 1 }).then(d => setComedyMovies(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'movie', category: 'horror', page: 1 }).then(d => setHorrorMovies(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'movie', category: 'animation', page: 1 }).then(d => setAnimationMovies(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'tv', category: 'drama', page: 1 }).then(d => setDramaSeries(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'tv', category: 'crime', page: 1 }).then(d => setCrimeSeries(d.items?.slice(0, 12) || [])).catch(() => {}),
    ]);
    setExtraLoaded(true);
  }, [extraLoaded]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (!loading) loadExtra(); }, [loading, loadExtra]);

  const heroItems = trending.filter(v => v.backdrop || v.poster).slice(0, 6);

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">
      {/* Hero */}
      {loading ? <SkeletonHero /> : <HeroSlider items={heroItems} />}

      <div className="mt-6">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          <>
            {series.length > 0 && (
              <ContentRow title="أحدث المسلسلات" items={series} seeAllHref="/allcontent?type=tv" showBadge />
            )}
            {movies.length > 0 && (
              <ContentRow title="أحدث الأفلام" items={movies} seeAllHref="/allcontent?type=movie" showBadge />
            )}
          </>
        )}

        {/* Live Channels — poster style */}
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
                  {/* Logo centered */}
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
                  {/* Bottom gradient + name */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-2 px-2">
                    <span className="text-[10px] font-bold text-white text-center block line-clamp-1">{ch.name}</span>
                  </div>
                  {/* Live badge */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-red-600/90 px-1.5 py-0.5 rounded-md">
                    <div className="w-1 h-1 rounded-full bg-white live-dot" />
                    <span className="text-[8px] font-bold text-white">مباشر</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {trending.length > 0 && (
          <ContentRow title="الأكثر رواجاً" items={trending} seeAllHref="/allcontent" showBadge />
        )}
        {popularMovies.length > 0 && (
          <ContentRow title="أفلام شائعة" items={popularMovies} seeAllHref="/allcontent?type=movie" showBadge />
        )}
        {popularSeries.length > 0 && (
          <ContentRow title="مسلسلات شائعة" items={popularSeries} seeAllHref="/allcontent?type=tv" showBadge />
        )}

        {!extraLoaded && !loading ? (
          <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
        ) : (
          <>
            {actionMovies.length > 0 && <ContentRow title="أفلام أكشن" items={actionMovies} seeAllHref="/allcontent?type=movie&category=action" showBadge />}
            {comedyMovies.length > 0 && <ContentRow title="أفلام كوميدي" items={comedyMovies} seeAllHref="/allcontent?type=movie&category=comedy" showBadge />}
            {horrorMovies.length > 0 && <ContentRow title="أفلام رعب" items={horrorMovies} seeAllHref="/allcontent?type=movie&category=horror" showBadge />}
            {animationMovies.length > 0 && <ContentRow title="أفلام أنيميشن" items={animationMovies} seeAllHref="/allcontent?type=movie&category=animation" showBadge />}
            {dramaSeries.length > 0 && <ContentRow title="مسلسلات دراما" items={dramaSeries} seeAllHref="/allcontent?type=tv&category=drama" showBadge />}
            {crimeSeries.length > 0 && <ContentRow title="مسلسلات جريمة" items={crimeSeries} seeAllHref="/allcontent?type=tv&category=crime" showBadge />}
          </>
        )}
      </div>
    </div>
  );
}
