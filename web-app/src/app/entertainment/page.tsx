'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchIptvHome, fetchIptvCategoriesWithMovies, IptvVodItem, IptvCategoryWithMovies } from '@/constants/api';
import ContentRow from '@/components/ContentRow';
import { SkeletonRow } from '@/components/Skeleton';

function toContentItem(v: IptvVodItem) {
  return { id: v.id, title: v.name, poster: v.poster, vod_type: v.vod_type, year: v.year, rating: v.rating };
}

export default function EntertainmentPage() {
  const [loading, setLoading] = useState(true);
  const [latestMovies, setLatestMovies] = useState<IptvVodItem[]>([]);
  const [latestSeries, setLatestSeries] = useState<IptvVodItem[]>([]);
  const [categories, setCategories] = useState<IptvCategoryWithMovies[]>([]);

  const load = useCallback(async () => {
    try {
      const [home, cats] = await Promise.all([
        fetchIptvHome(),
        fetchIptvCategoriesWithMovies(10),
      ]);
      setLatestMovies(home.latestMovies || []);
      setLatestSeries(home.latestSeries || []);
      setCategories(cats.categories || []);
    } catch (e) {
      console.error('Entertainment load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 2L12 7L7 2" /><polygon points="10,11 10,17 16,14" fill="currentColor" stroke="none" /></svg>
        <h1 className="text-xl font-black text-light-text dark:text-dark-text">استكشف</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
        {[
          { label: 'رياضة', href: '/sports', icon: '⚽' },
          { label: 'أطفال', href: '/kids', icon: '🎈' },
          { label: 'أفلام', href: '/allcontent?type=movie', icon: '🎬' },
          { label: 'مسلسلات', href: '/allcontent?type=series', icon: '📺' },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-light-card dark:bg-dark-card hover:bg-brand-primary/15 text-sm font-bold text-light-text dark:text-dark-text transition">
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      <div className="mt-2">
        {loading ? (
          <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
        ) : (
          <>
            {latestMovies.length > 0 && <ContentRow title="أحدث الأفلام" items={latestMovies.map(toContentItem)} seeAllHref="/allcontent?type=movie" />}
            {latestSeries.length > 0 && <ContentRow title="أحدث المسلسلات" items={latestSeries.map(toContentItem)} seeAllHref="/allcontent?type=series" />}
            {categories.map(cat => (
              cat.items.length > 0 && (
                <ContentRow key={cat.id} title={cat.name} items={cat.items.map(toContentItem)} seeAllHref={`/allcontent?type=movie&categoryId=${cat.id}`} />
              )
            ))}
          </>
        )}
      </div>
    </div>
  );
}
