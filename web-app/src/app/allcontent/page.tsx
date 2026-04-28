'use client';
import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchLuluList, fetchLuluGenres, LuluItem } from '@/constants/api';
import ContentCard from '@/components/ContentCard';
import { SkeletonGrid } from '@/components/Skeleton';

const TYPES = [{ id: 'movie', label: 'أفلام' }, { id: 'series', label: 'مسلسلات' }];

function AllContentContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<LuluItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<'movie' | 'series'>(
    (params.get('type') as 'movie' | 'series') || 'movie'
  );
  const [genres, setGenres] = useState<string[]>([]);
  const [activeGenre, setActiveGenre] = useState<string>('');

  const load = useCallback(async (p = 1, reset = false) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const data = await fetchLuluList({ type: activeType, page: p, search: searchQuery || undefined, cat: activeGenre || undefined });
      const newItems = data.items || [];
      setItems(prev => reset ? newItems : [...prev, ...newItems]);
      setHasMore(data.hasMore);
    } catch (e) {
      console.error('Content load error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeType, searchQuery, activeGenre]);

  useEffect(() => { fetchLuluGenres().then(setGenres); }, []);

  useEffect(() => { setPage(1); load(1, true); }, [activeType, searchQuery, activeGenre]);

  const loadMore = () => { const next = page + 1; setPage(next); load(next); };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setSearchQuery(search); };

  const toCard = (item: LuluItem) => ({
    id    : item.id,
    title : item.title,
    poster: item.poster,
    vod_type: item.vod_type,
    year  : item.year,
    rating: item.rating,
    source: 'lulu',
  });

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="py-4">
          <h1 className="text-xl font-black text-light-text dark:text-dark-text mb-3">تصفح المحتوى</h1>

          <form onSubmit={handleSearch} className="relative mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن فيلم أو مسلسل..."
              className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-3 pr-10 text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2">
            {TYPES.map(t => (
              <button key={t.id} onClick={() => { setActiveType(t.id as 'movie' | 'series'); setSearchQuery(''); setSearch(''); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeType === t.id ? 'bg-brand-primary text-black' : 'bg-light-input dark:bg-dark-input text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'}`}
              >{t.label}</button>
            ))}
          </div>

          {genres.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-2">
              <button
                onClick={() => setActiveGenre('')}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeGenre === '' ? 'bg-brand-primary text-black' : 'bg-light-input dark:bg-dark-input text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
                }`}
              >
                الكل
              </button>
              {genres.map(g => (
                <button key={g} onClick={() => setActiveGenre(g)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                    activeGenre === g ? 'bg-brand-primary text-black' : 'bg-light-input dark:bg-dark-input text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
                  }`}
                >{g}</button>
              ))}
            </div>
          )}
        </div>

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
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-xl bg-brand-primary hover:bg-brand-dark text-black font-bold text-sm transition disabled:opacity-50"
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

export default function AllContentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark-bg flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <AllContentContent />
    </Suspense>
  );
}
