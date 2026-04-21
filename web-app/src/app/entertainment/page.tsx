'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { fetchLuluList, LuluItem } from '@/constants/api';
import ContentCard from '@/components/ContentCard';
import { SkeletonGrid } from '@/components/Skeleton';

const TYPES = [
  { id: '', label: 'الكل' },
  { id: 'movie', label: 'أفلام' },
  { id: 'series', label: 'مسلسلات' },
];

export default function EntertainmentPage() {
  const [activeType, setActiveType] = useState<'movie' | 'series' | ''>('');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [items, setItems] = useState<LuluItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (p = 1, reset = false) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      // إذا "الكل" → جلب أفلام ومسلسلات معاً (صفحة 1 فقط) أو أفلام للصفحات التالية
      let newItems: LuluItem[] = [];
      let moreAvailable = false;

      if (activeType === '') {
        // "الكل": دمج أفلام + مسلسلات في الصفحة الأولى
        const [moviesData, seriesData] = await Promise.all([
          fetchLuluList({ type: 'movie', page: p, search: searchQuery.trim() || undefined }),
          fetchLuluList({ type: 'series', page: p, search: searchQuery.trim() || undefined }),
        ]);
        newItems = [...(moviesData.items || []), ...(seriesData.items || [])];
        moreAvailable = (moviesData.hasMore ?? false) || (seriesData.hasMore ?? false);
      } else {
        const data = await fetchLuluList({
          type: activeType as 'movie' | 'series',
          page: p,
          search: searchQuery.trim() || undefined,
        });
        newItems = data.items || [];
        moreAvailable = data.hasMore ?? newItems.length >= 20;
      }

      setItems(prev => reset ? newItems : [...prev, ...newItems]);
      setHasMore(moreAvailable);
    } catch (e) {
      console.error('Content load error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeType, searchQuery]);

  useEffect(() => { setPage(1); load(1, true); }, [activeType, searchQuery]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    load(next);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(search);
  };

  const toCard = (item: LuluItem) => ({
    id: item.id,
    title: item.title,
    poster: item.poster,
    vod_type: item.vod_type,
    year: item.year,
    rating: item.rating,
    source: 'lulu',
  });

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">
      <div className="max-w-7xl mx-auto px-3 md:px-4">
        {/* Header - hidden on mobile (shown in bottom nav), visible on desktop */}
        <div className="hidden md:flex pt-4 pb-2 items-center gap-2">
          <svg className="w-6 h-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 2L12 7L7 2" /><polygon points="10,11 10,17 16,14" fill="currentColor" stroke="none" /></svg>
          <h1 className="text-xl font-black text-light-text dark:text-dark-text">ترفيه</h1>
        </div>

        {/* Search + Type filters — compact on mobile like the app */}
        <div className="flex items-center gap-1.5 md:gap-2 pt-2 md:pt-0 mb-1.5 md:mb-3">
          <form onSubmit={handleSearch} className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث..."
              className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-[10px] md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 pr-8 md:pr-10 text-[13px] md:text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
            <button type="submit" className="absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2">
              <svg className="w-3.5 md:w-4 h-3.5 md:h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchQuery(''); }} className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2">
                <svg className="w-3.5 md:w-4 h-3.5 md:h-4 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </form>
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveType(t.id as '' | 'movie' | 'series'); setSearchQuery(''); setSearch(''); }}
              className={`flex-shrink-0 px-2.5 md:px-3.5 py-2 md:py-2.5 rounded-[10px] md:rounded-xl text-xs md:text-sm font-bold transition ${
                activeType === t.id
                  ? 'bg-brand-primary text-black'
                  : 'bg-transparent md:bg-light-input md:dark:bg-dark-input text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
              }`}
            >{t.label}</button>
          ))}
        </div>


        {/* Content grid — 3 cols on mobile like the app */}
        {loading ? (
          <SkeletonGrid count={24} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="w-14 h-14 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-light-muted dark:text-dark-muted font-medium">لا توجد نتائج</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
              {items.map((item, i) => (
                <ContentCard key={`${item.id}_${i}`} item={toCard(item) as any} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6 md:mt-8 mb-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 md:px-8 py-2.5 md:py-3 rounded-xl bg-brand-primary hover:bg-brand-dark text-black font-bold text-xs md:text-sm transition disabled:opacity-50"
                >
                  {loadingMore ? 'جارٍ التحميل...' : 'تحميل المزيد'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
