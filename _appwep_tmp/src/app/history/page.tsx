'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWatchHistory, WatchHistoryItem, isLoggedIn } from '@/constants/api';

export default function HistoryPage() {
  const [items, setItems] = useState<WatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    isLoggedIn().then(async (l) => {
      setLoggedIn(l);
      if (l) {
        const data = await fetchWatchHistory({ limit: 50 });
        setItems(data.items || []);
      }
      setLoading(false);
    });
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center gap-4 px-4">
        <svg className="w-14 h-14 text-brand-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">سجل المشاهدة</h2>
        <p className="text-sm text-light-muted dark:text-dark-muted text-center">سجل الدخول لمشاهدة تاريخ مشاهداتك</p>
        <Link href="/account" className="px-6 py-2.5 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center gap-4 px-4">
        <svg className="w-14 h-14 text-brand-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">لا توجد مشاهدات</h2>
        <p className="text-sm text-light-muted dark:text-dark-muted">ابدأ المشاهدة وستظهر هنا</p>
        <Link href="/" className="px-6 py-2.5 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition">
          استعرض المحتوى
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-24 md:pb-6">
      <div className="max-w-3xl mx-auto px-4">
        <div className="py-4 flex items-center gap-2">
          <h1 className="text-xl font-black text-light-text dark:text-dark-text">سجل المشاهدة</h1>
          <span className="px-2 py-0.5 rounded-full bg-brand-primary/15 text-brand-primary text-xs font-bold">{items.length}</span>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const type = item.content_type === 'series' ? 'tv' : 'movie';
            const href = `/detail?tmdbId=${item.item_id}&type=${type}&title=${encodeURIComponent(item.title || '')}&poster=${encodeURIComponent(item.poster || '')}`;
            return (
              <Link key={item.id} href={href} className="flex items-center gap-3 p-3 rounded-xl bg-light-card dark:bg-dark-card hover:bg-light-input dark:hover:bg-dark-input transition group">
                {/* Poster */}
                <div className="w-16 h-22 flex-shrink-0 rounded-lg overflow-hidden bg-dark-input" style={{ height: '88px' }}>
                  {item.poster && !imgErrors.has(item.id) ? (
                    <img src={item.poster} alt={item.title} className="w-full h-full object-cover" onError={() => setImgErrors(p => new Set(p).add(item.id))} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-dark-card">
                      <svg className="w-6 h-6 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${item.content_type === 'series' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-brand-primary/20 text-brand-primary'}`}>
                      {item.content_type === 'series' ? 'مسلسل' : 'فيلم'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-light-text dark:text-dark-text line-clamp-1">{item.title || item.item_id}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <svg className="w-3 h-3 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs text-light-muted dark:text-dark-muted">{formatDate(item.watched_at)}</span>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-light-muted dark:text-dark-muted group-hover:text-brand-primary transition rotate-180 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
