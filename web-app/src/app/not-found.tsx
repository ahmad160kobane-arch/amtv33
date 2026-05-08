'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="w-20 h-20 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
        <svg className="w-10 h-10 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h1 className="text-4xl font-black text-brand-primary mb-1">404</h1>
        <h2 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">الصفحة غير موجودة</h2>
        <p className="text-sm text-light-muted dark:text-dark-muted max-w-xs">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
      </div>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition"
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
