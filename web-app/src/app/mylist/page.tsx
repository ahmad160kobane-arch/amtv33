'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import ContentCard from '@/components/ContentCard';

interface SavedItem {
  id: string;
  title: string;
  poster: string;
  type: 'movie' | 'series';
  year?: string;
  rating?: string;
}

export default function MyListPage() {
  const router = useRouter();
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved items from localStorage
    const saved = localStorage.getItem('mylist');
    if (saved) {
      try {
        setSavedItems(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved items:', e);
      }
    }
    setLoading(false);
  }, []);

  const removeItem = (id: string) => {
    const updated = savedItems.filter(item => item.id !== id);
    setSavedItems(updated);
    localStorage.setItem('mylist', JSON.stringify(updated));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-6 h-6 text-brand-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            <h1 className="text-xl font-black text-light-text dark:text-dark-text">قائمتي</h1>
          </div>
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-20 md:pb-6">
      <div className="px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-6 h-6 text-brand-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
          <h1 className="text-xl font-black text-light-text dark:text-dark-text">قائمتي</h1>
          {savedItems.length > 0 && (
            <span className="text-xs font-bold text-light-muted dark:text-dark-muted">
              ({savedItems.length})
            </span>
          )}
        </div>

        {savedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="w-16 h-16 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-light-text dark:text-dark-text font-bold text-base">
              قائمتك فارغة
            </p>
            <p className="text-light-muted dark:text-dark-muted text-sm text-center px-4">
              أضف أفلام ومسلسلات لمشاهدتها لاحقاً
            </p>
            <button
              onClick={() => router.push('/entertainment')}
              className="mt-4 px-6 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-dark text-black font-bold text-sm transition"
            >
              تصفح المحتوى
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
            {savedItems.map((item) => (
              <div key={item.id} className="relative group">
                <ContentCard
                  item={{
                    id: item.id,
                    title: item.title,
                    poster: item.poster,
                    vod_type: item.type,
                    year: item.year,
                    rating: item.rating,
                    source: 'lulu',
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  className="absolute top-1 left-1 p-1.5 rounded-full bg-red-500/90 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="إزالة من القائمة"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
