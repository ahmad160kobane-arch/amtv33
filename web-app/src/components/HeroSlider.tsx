'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { VidsrcItem } from '@/constants/api';

interface Props {
  items: VidsrcItem[];
}

export default function HeroSlider({ items }: Props) {
  const [current, setCurrent] = useState(0);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  const next = useCallback(() => setCurrent((c) => (c + 1) % items.length), [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(next, 5000);
    return () => clearInterval(id);
  }, [next, items.length]);

  if (!items.length) return null;

  const item = items[current];
  const type = item.vod_type === 'series' ? 'series' : 'movie';
  const sourceParam = (item as any).source ? `&source=${(item as any).source}` : '';
  const href = `/detail?id=${item.id}&type=${type}&title=${encodeURIComponent(item.title)}&poster=${encodeURIComponent(item.poster || '')}${sourceParam}`;
  const bg = imgErrors.has(current) ? null : (item.backdrop || item.poster);

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'clamp(260px, 45vw, 620px)' }}>
      {/* Background image */}
      {bg ? (
        <img
          key={current}
          src={bg}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          onError={() => setImgErrors((s) => new Set(s).add(current))}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-dark-card to-dark-bg" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" style={{ direction: 'ltr' }} />

      {/* Content */}
      <div className="absolute bottom-0 right-0 left-0 p-5 md:p-8 max-w-2xl mr-0 ml-auto" style={{ textAlign: 'right' }}>
        {/* Type + Year chips */}
        <div className="flex items-center gap-2 mb-2 justify-end">
          {item.year && (
            <span className="text-xs text-white/70 font-medium">{item.year}</span>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.vod_type === 'series' ? 'bg-indigo-500 text-white' : 'bg-brand-primary text-black'}`}>
            {item.vod_type === 'series' ? 'مسلسل' : 'فيلم'}
          </span>
          {item.rating && (
            <div className="flex items-center gap-0.5 bg-black/40 px-1.5 py-0.5 rounded">
              <svg className="w-2.5 h-2.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-xs text-white font-bold">{item.rating}</span>
            </div>
          )}
        </div>

        <h1 className="text-white font-black text-xl md:text-3xl leading-tight mb-3 line-clamp-2">{item.title}</h1>

        {item.genres && item.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4 justify-end">
            {item.genres.slice(0, 3).map((g) => (
              <span key={g} className="px-2 py-0.5 rounded-full bg-white/10 text-white text-xs">{g}</span>
            ))}
          </div>
        )}

        <Link
          href={href}
          className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-dark text-black font-bold px-5 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-brand-primary/30"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          مشاهدة الآن
        </Link>
      </div>

      {/* Pagination dots */}
      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all ${i === current ? 'w-5 h-1.5 bg-brand-primary' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
