'use client';
import React from 'react';

export function SkeletonCard({ width = 'w-36' }: { width?: string }) {
  return (
    <div className={`${width} flex-shrink-0`}>
      <div className="w-full aspect-[2/3] rounded-xl bg-light-input dark:bg-dark-input skeleton" />
      <div className="mt-2 h-3 rounded bg-light-input dark:bg-dark-input skeleton w-4/5" />
      <div className="mt-1 h-2.5 rounded bg-light-input dark:bg-dark-input skeleton w-2/5" />
    </div>
  );
}

export function SkeletonRow({ count = 6, cardWidth = 'w-36' }: { count?: number; cardWidth?: string }) {
  return (
    <div className="mb-8">
      <div className="px-4 mb-3 flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-light-input dark:bg-dark-input skeleton" />
        <div className="h-4 w-32 rounded bg-light-input dark:bg-dark-input skeleton" />
      </div>
      <div className="flex gap-3 px-4 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} width={cardWidth} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="w-full bg-light-input dark:bg-dark-input skeleton" style={{ height: 'clamp(220px, 50vw, 520px)' }} />
  );
}

export function SkeletonChannelCard() {
  return (
    <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-light-card dark:bg-dark-card skeleton">
      <div className="w-full aspect-video rounded-lg bg-light-input dark:bg-dark-input" />
      <div className="h-2.5 w-3/4 rounded bg-light-input dark:bg-dark-input" />
    </div>
  );
}

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="w-full aspect-[2/3] rounded-xl bg-light-input dark:bg-dark-input skeleton" />
          <div className="mt-2 h-3 rounded bg-light-input dark:bg-dark-input skeleton w-4/5" />
        </div>
      ))}
    </div>
  );
}
