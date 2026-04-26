'use client';
import React from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-dark-card flex items-center justify-center mb-2">
        <svg className="w-10 h-10 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18" />
        </svg>
      </div>

      <div>
        <h1 className="text-2xl font-black text-white mb-2">أنت غير متصل</h1>
        <p className="text-dark-muted text-sm leading-relaxed max-w-xs">
          لا يوجد اتصال بالإنترنت. تحقق من اتصالك وحاول مجدداً.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition-all hover:scale-105 active:scale-95">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        إعادة المحاولة
      </button>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <p className="text-dark-muted text-xs mb-1">الصفحات المحفوظة</p>
        {['/', '/live', '/entertainment', '/kids'].map((href) => {
          const labels: Record<string, string> = { '/': 'الرئيسية', '/live': 'مباشر', '/entertainment': 'ترفيه', '/kids': 'أطفال' };
          return (
            <Link key={href} href={href}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-dark-card text-dark-text hover:bg-dark-input transition">
              <span className="text-sm font-medium">{labels[href]}</span>
              <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
