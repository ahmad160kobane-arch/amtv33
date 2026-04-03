'use client';
import React, { useState } from 'react';
import Link from 'next/link';
interface ContentItem {
  id: string;
  title: string;
  poster: string;
  vod_type: 'movie' | 'series';
  year?: string;
  rating?: string;
  tmdb_id?: string;
}

interface Props {
  item: ContentItem;
}

export default function ContentCard({ item }: Props) {
  const [imgError, setImgError] = useState(false);
  const type = item.vod_type === 'series' ? 'series' : 'movie';
  const href = `/detail?id=${item.id}&type=${type}&title=${encodeURIComponent(item.title)}&poster=${encodeURIComponent(item.poster || '')}`;

  return (
    <Link href={href} className="block w-full group cursor-pointer card-hover">
      <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-dark-input">
        {item.poster && !imgError ? (
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-dark-card">
            <svg className="w-10 h-10 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Type badge */}
        <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
          item.vod_type === 'series' ? 'bg-indigo-500/90 text-white' : 'bg-amber-500/90 text-white'
        }`}>
          {item.vod_type === 'series' ? 'مسلسل' : 'فيلم'}
        </div>

        {/* Rating badge */}
        {item.rating && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 px-1.5 py-0.5 rounded-md">
            <svg className="w-2.5 h-2.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-[9px] text-white font-bold">{item.rating}</span>
          </div>
        )}

        {/* Play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-10 h-10 rounded-full bg-brand-primary/90 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white mr-[-2px]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Title */}
      <p className="mt-1.5 text-xs font-medium text-light-text dark:text-dark-text line-clamp-1 px-0.5">
        {item.title}
      </p>
      {item.year && (
        <p className="text-[10px] text-light-muted dark:text-dark-muted px-0.5">{item.year}</p>
      )}
    </Link>
  );
}
