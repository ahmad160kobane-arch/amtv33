'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchVidsrcBrowse, fetchFreeChannels, VidsrcItem, FreeChannel } from '@/constants/api';
import ContentRow from '@/components/ContentRow';
import { SkeletonRow } from '@/components/Skeleton';

export default function KidsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<FreeChannel[]>([]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [animSeries, setAnimSeries] = useState<VidsrcItem[]>([]);
  const [animMovies, setAnimMovies] = useState<VidsrcItem[]>([]);
  const [familyMovies, setFamilyMovies] = useState<VidsrcItem[]>([]);

  const load = useCallback(async () => {
    try {
      await Promise.all([
        fetchFreeChannels({ group: 'أطفال', limit: 20 }).then(d => setChannels(d.channels || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'tv', category: 'animation', page: 1 }).then(d => setAnimSeries(d.items?.slice(0, 16) || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'movie', category: 'animation', page: 1 }).then(d => setAnimMovies(d.items?.slice(0, 16) || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'movie', category: 'family', page: 1 }).then(d => setFamilyMovies(d.items?.slice(0, 16) || [])).catch(() => {}),
      ]);
    } finally {
      setLoading(false);
    }
  }, []); 

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h1 className="text-xl font-black text-light-text dark:text-dark-text">أطفال</h1>
        </div>
      </div>

      {/* Kids channels */}
      {channels.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 px-4 mb-3">
            <div className="w-1 h-5 rounded-full bg-brand-primary" />
            <h2 className="text-base font-bold text-light-text dark:text-dark-text">قنوات الأطفال</h2>
            <div className="w-1.5 h-1.5 rounded-full bg-brand-success live-dot" />
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-2">
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => router.push(`/live?channelId=${ch.id}`)}
                className="w-28 flex-shrink-0 flex flex-col items-center p-3 rounded-xl bg-light-card dark:bg-dark-card hover:bg-light-input dark:hover:bg-dark-input transition relative"
              >
                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand-success live-dot" />
                <div className="w-14 h-10 rounded-lg bg-light-input dark:bg-dark-input flex items-center justify-center mb-2 overflow-hidden">
                  {ch.logo && !logoErrors.has(ch.id) ? (
                    <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain" onError={() => setLogoErrors(p => new Set(p).add(ch.id))} />
                  ) : (
                    <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 2L12 7L7 2" /></svg>
                  )}
                </div>
                <span className="text-[10px] font-bold text-light-text dark:text-dark-text text-center line-clamp-1">{ch.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
      ) : (
        <>
          {animSeries.length > 0 && <ContentRow title="مسلسلات أنيميشن" items={animSeries} seeAllHref="/allcontent?type=tv&category=animation" />}
          {animMovies.length > 0 && <ContentRow title="أفلام أنيميشن" items={animMovies} seeAllHref="/allcontent?type=movie&category=animation" />}
          {familyMovies.length > 0 && <ContentRow title="أفلام عائلية" items={familyMovies} seeAllHref="/allcontent?type=movie&category=family" />}
        </>
      )}
    </div>
  );
}
