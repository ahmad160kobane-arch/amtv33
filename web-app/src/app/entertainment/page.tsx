'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { fetchVidsrcBrowse, fetchVidsrcHome, VidsrcItem } from '@/constants/api';
import HeroSlider from '@/components/HeroSlider';
import ContentRow from '@/components/ContentRow';
import { SkeletonHero, SkeletonRow } from '@/components/Skeleton';

export default function EntertainmentPage() {
  const [loading, setLoading] = useState(true);
  const [trending, setTrending] = useState<VidsrcItem[]>([]);
  const [latestMovies, setLatestMovies] = useState<VidsrcItem[]>([]);
  const [latestSeries, setLatestSeries] = useState<VidsrcItem[]>([]);
  const [comedy, setComedy] = useState<VidsrcItem[]>([]);
  const [drama, setDrama] = useState<VidsrcItem[]>([]);
  const [action, setAction] = useState<VidsrcItem[]>([]);
  const [romance, setRomance] = useState<VidsrcItem[]>([]);
  const [thriller, setThriller] = useState<VidsrcItem[]>([]);
  const [scifi, setScifi] = useState<VidsrcItem[]>([]);
  const [mystery, setMystery] = useState<VidsrcItem[]>([]);

  const load = useCallback(async () => {
    try {
      const home = await fetchVidsrcHome();
      setTrending(home.trending || []);
      setLatestMovies(home.latestMovies || []);
      setLatestSeries(home.latestTvShows || []);
    } catch (e) {
      console.error('Entertainment load error:', e);
    } finally {
      setLoading(false);
    }
    await Promise.all([
      fetchVidsrcBrowse({ type: 'movie', category: 'comedy', page: 1 }).then(d => setComedy(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'tv', category: 'drama', page: 1 }).then(d => setDrama(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'movie', category: 'action', page: 1 }).then(d => setAction(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'movie', category: 'romance', page: 1 }).then(d => setRomance(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'movie', category: 'thriller', page: 1 }).then(d => setThriller(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'movie', category: 'science-fiction', page: 1 }).then(d => setScifi(d.items?.slice(0, 12) || [])).catch(() => {}),
      fetchVidsrcBrowse({ type: 'tv', category: 'mystery', page: 1 }).then(d => setMystery(d.items?.slice(0, 12) || [])).catch(() => {}),
    ]).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const heroItems = trending.filter(v => v.backdrop || v.poster).slice(0, 6);

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 2L12 7L7 2" /><polygon points="10,11 10,17 16,14" fill="currentColor" stroke="none" /></svg>
        <h1 className="text-xl font-black text-light-text dark:text-dark-text">ترفيه</h1>
      </div>

      {loading ? <SkeletonHero /> : <HeroSlider items={heroItems} />}

      <div className="mt-6">
        {loading ? (
          <><SkeletonRow /><SkeletonRow /></>
        ) : (
          <>
            {latestSeries.length > 0 && <ContentRow title="أحدث المسلسلات" items={latestSeries} seeAllHref="/allcontent?type=tv" />}
            {latestMovies.length > 0 && <ContentRow title="أحدث الأفلام" items={latestMovies} seeAllHref="/allcontent?type=movie" />}
            {drama.length > 0 && <ContentRow title="مسلسلات دراما" items={drama} seeAllHref="/allcontent?type=tv&category=drama" />}
            {action.length > 0 && <ContentRow title="أفلام أكشن" items={action} seeAllHref="/allcontent?type=movie&category=action" />}
            {comedy.length > 0 && <ContentRow title="أفلام كوميدي" items={comedy} seeAllHref="/allcontent?type=movie&category=comedy" />}
            {romance.length > 0 && <ContentRow title="أفلام رومانسية" items={romance} seeAllHref="/allcontent?type=movie&category=romance" />}
            {thriller.length > 0 && <ContentRow title="أفلام إثارة" items={thriller} seeAllHref="/allcontent?type=movie&category=thriller" />}
            {scifi.length > 0 && <ContentRow title="خيال علمي" items={scifi} seeAllHref="/allcontent?type=movie&category=science-fiction" />}
            {mystery.length > 0 && <ContentRow title="مسلسلات غموض" items={mystery} seeAllHref="/allcontent?type=tv&category=mystery" />}
          </>
        )}
      </div>
    </div>
  );
}
