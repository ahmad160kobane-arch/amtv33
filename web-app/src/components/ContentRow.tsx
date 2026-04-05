'use client';
import React, { useRef } from 'react';
import Link from 'next/link';
import ContentCard from './ContentCard';

interface ContentItem {
  id: string;
  title: string;
  poster: string;
  vod_type: 'movie' | 'series';
  year?: string;
  rating?: string;
}

interface Props {
  title: string;
  items: ContentItem[];
  seeAllHref?: string;
  showBadge?: boolean;
  cardWidth?: string;
}

export default function ContentRow({ title, items, seeAllHref, cardWidth = 'w-32 sm:w-36 md:w-40 lg:w-44' }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'prev' | 'next') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    // RTL: 'next' scrolls left (negative), 'prev' scrolls right (positive)
    scrollRef.current.scrollBy({ left: dir === 'next' ? -amount : amount, behavior: 'smooth' });
  };

  if (!items.length) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-brand-primary" />
          <h2 className="text-base font-bold text-light-text dark:text-dark-text">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {seeAllHref && (
            <Link href={seeAllHref} className="text-xs font-medium text-brand-primary hover:text-brand-dark transition">
              المزيد
            </Link>
          )}
          {/* Desktop scroll buttons — prev goes right (←), next goes left (→) in RTL */}
          <div className="hidden md:flex gap-1">
            <button
              onClick={() => scroll('prev')}
              title="السابق"
              className="w-7 h-7 rounded-full bg-light-input dark:bg-dark-input flex items-center justify-center hover:bg-brand-primary/20 hover:text-brand-primary transition"
            >
              <svg className="w-3.5 h-3.5 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => scroll('next')}
              title="التالي"
              className="w-7 h-7 rounded-full bg-light-input dark:bg-dark-input flex items-center justify-center hover:bg-brand-primary/20 hover:text-brand-primary transition"
            >
              <svg className="w-3.5 h-3.5 text-light-muted dark:text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {items.map((item) => (
          <div key={item.id} className={`flex-shrink-0 ${cardWidth}`} style={{ scrollSnapAlign: 'start' }}>
            <ContentCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
