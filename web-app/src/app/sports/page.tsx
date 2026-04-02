'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchVidsrcBrowse, fetchFreeChannels, fetchChannels, VidsrcItem, FreeChannel, Channel } from '@/constants/api';
import ContentRow from '@/components/ContentRow';
import { SkeletonRow } from '@/components/Skeleton';

export default function SportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const [freeChannels, setFreeChannels] = useState<FreeChannel[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [action, setAction] = useState<VidsrcItem[]>([]);
  const [adventure, setAdventure] = useState<VidsrcItem[]>([]);

  const load = useCallback(async () => {
    try {
      await Promise.all([
        fetchFreeChannels({ group: 'رياضة', limit: 30 }).then(d => setFreeChannels(d.channels || [])).catch(() => {}),
        fetchChannels({ group: 'sport', limit: 20 }).then(d => setChannels(d.items || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'movie', category: 'action', page: 1 }).then(d => setAction(d.items?.slice(0, 16) || [])).catch(() => {}),
        fetchVidsrcBrowse({ type: 'movie', category: 'adventure', page: 1 }).then(d => setAdventure(d.items?.slice(0, 16) || [])).catch(() => {}),
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
          <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32" /></svg>
          <h1 className="text-xl font-black text-light-text dark:text-dark-text">رياضة</h1>
        </div>
      </div>

      {/* Free Sports Channels */}
      {(loading || freeChannels.length > 0) && (
        <section className="mb-8">
          <div className="flex items-center gap-2 px-4 mb-3">
            <div className="w-1 h-5 rounded-full bg-brand-primary" />
            <h2 className="text-base font-bold text-light-text dark:text-dark-text">قنوات رياضية مجانية</h2>
            <div className="w-1.5 h-1.5 rounded-full bg-brand-success live-dot" />
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-2">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-28 flex-shrink-0 p-3 rounded-xl bg-dark-card skeleton">
                  <div className="w-14 h-10 rounded-lg bg-dark-input mx-auto mb-2" />
                  <div className="h-2.5 w-16 rounded bg-dark-input mx-auto" />
                </div>
              ))
            ) : freeChannels.map(ch => (
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
                    <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72" /></svg>
                  )}
                </div>
                <span className="text-[10px] font-bold text-light-text dark:text-dark-text text-center line-clamp-1">{ch.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <><SkeletonRow /><SkeletonRow /></>
      ) : (
        <>
          {action.length > 0 && <ContentRow title="أفلام أكشن" items={action} seeAllHref="/allcontent?type=movie&category=action" />}
          {adventure.length > 0 && <ContentRow title="أفلام مغامرات" items={adventure} seeAllHref="/allcontent?type=movie&category=adventure" />}
        </>
      )}
    </div>
  );
}
