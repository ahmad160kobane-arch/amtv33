'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchFavorites, FavoriteItem, isLoggedIn } from '@/constants/api';

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    isLoggedIn().then(async (l) => {
      setLoggedIn(l);
      if (l) {
        const data = await fetchFavorites();
        setItems(data);
      }
      setLoading(false);
    });
  }, []);

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
        <svg className="w-14 h-14 text-red-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">المفضلة</h2>
        <p className="text-sm text-light-muted dark:text-dark-muted text-center">سجل الدخول لعرض المفضلة</p>
        <Link href="/account" className="px-6 py-2.5 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center gap-4 px-4">
        <svg className="w-14 h-14 text-red-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">لا توجد مفضلة</h2>
        <p className="text-sm text-light-muted dark:text-dark-muted">أضف محتوى لمفضلتك من صفحة التفاصيل</p>
        <Link href="/" className="px-6 py-2.5 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition">
          استعرض المحتوى
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="py-4 flex items-center gap-2">
          <h1 className="text-xl font-black text-light-text dark:text-dark-text">المفضلة</h1>
          <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-bold">{items.length}</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
          {items.map((item) => {
            const type = item.content_type === 'series' ? 'tv' : 'movie';
            const href = `/detail?tmdbId=${item.item_id}&type=${type}&title=${encodeURIComponent(item.title)}&poster=${encodeURIComponent(item.poster || '')}`;
            return (
              <Link key={item.id} href={href} className="group">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-light-card dark:bg-dark-card">
                  {item.poster && !imgErrors.has(item.id) ? (
                    <img src={item.poster} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={() => setImgErrors(p => new Set(p).add(item.id))} loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-light-input dark:bg-dark-input">
                      <svg className="w-8 h-8 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${item.content_type === 'series' ? 'bg-indigo-500 text-white' : 'bg-brand-primary text-black'}`}>
                    {item.content_type === 'series' ? 'مسلسل' : 'فيلم'}
                  </div>
                  <div className="absolute top-2 left-2">
                    <svg className="w-4 h-4 text-red-400 fill-red-400" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  </div>
                </div>
                <p className="mt-1.5 text-xs font-medium text-light-text dark:text-dark-text line-clamp-1">{item.title}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
