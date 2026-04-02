'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchSubscription, activateCode, SubscriptionInfo, isLoggedIn } from '@/constants/api';

export default function SubscriptionPage() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [code, setCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    isLoggedIn().then(async (l) => {
      setLoggedIn(l);
      if (l) {
        const data = await fetchSubscription();
        setSub(data);
      }
      setLoading(false);
    });
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(''); setSuccess(''); setActivating(true);
    try {
      const res = await activateCode(code.trim().toUpperCase());
      setSuccess(res.message || 'تم تفعيل الاشتراك بنجاح!');
      setCode('');
      const data = await fetchSubscription();
      setSub(data);
    } catch (err: any) {
      setError(err.message);
    } finally { setActivating(false); }
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
        <svg className="w-14 h-14 text-amber-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" /></svg>
        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">الاشتراك</h2>
        <p className="text-sm text-light-muted dark:text-dark-muted text-center">سجل الدخول لإدارة اشتراكك</p>
        <Link href="/account" className="px-6 py-2.5 rounded-xl bg-brand-primary text-black font-bold text-sm hover:bg-brand-dark transition">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  const isPremium = sub?.isPremium;

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-24 md:pb-6">
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-xl font-black text-light-text dark:text-dark-text mb-6">الاشتراك</h1>

        {/* Current plan card */}
        <div className={`rounded-2xl p-5 mb-6 ${isPremium ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30' : 'bg-light-card dark:bg-dark-card'}`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="flex items-center justify-center w-10 h-10">
            {isPremium ? (
              <svg className="w-8 h-8 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" /></svg>
            ) : (
              <svg className="w-8 h-8 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
          </span>
            <div>
              <h2 className="font-black text-light-text dark:text-dark-text text-lg">{isPremium ? 'بريميوم' : 'مجاني'}</h2>
              <p className="text-xs text-light-muted dark:text-dark-muted">
                {isPremium && sub?.expires_at ? `ينتهي: ${new Date(sub.expires_at).toLocaleDateString('ar-SA')}` : 'اشترك للحصول على محتوى أكثر'}
              </p>
            </div>
          </div>

          {isPremium && sub?.daysLeft !== null && sub?.daysLeft !== undefined && (
            <div className="flex items-center gap-2 bg-amber-500/10 rounded-xl px-3 py-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-amber-400 font-bold">{sub.daysLeft} يوم متبقي</span>
            </div>
          )}

          {!isPremium && (
            <div className="flex flex-col gap-2">
              {['مشاهدة بدون إعلانات', 'جودة عالية HD', 'محتوى حصري', 'بث مباشر للقنوات المميزة'].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-brand-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-light-muted dark:text-dark-muted">{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activate code */}
        <div className="bg-light-card dark:bg-dark-card rounded-2xl p-5">
          <h3 className="font-bold text-light-text dark:text-dark-text mb-1">تفعيل كود الاشتراك</h3>
          <p className="text-xs text-light-muted dark:text-dark-muted mb-4">أدخل كود الاشتراك الذي حصلت عليه</p>

          {success && (
            <div className="mb-3 p-3 rounded-xl bg-brand-success/10 border border-brand-success/20 text-brand-success text-sm text-center font-medium">
              <svg className="inline w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> {success}
            </div>
          )}
          {error && (
            <div className="mb-3 p-3 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleActivate} className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              className="flex-1 bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-3 text-sm font-bold tracking-widest placeholder:text-light-muted dark:placeholder:text-dark-muted placeholder:tracking-normal placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary/40 uppercase"
              style={{ direction: 'ltr', textAlign: 'center' }}
            />
            <button
              type="submit"
              disabled={activating || !code.trim()}
              className="px-5 py-3 rounded-xl bg-brand-primary hover:bg-brand-dark text-black font-bold text-sm transition disabled:opacity-50"
            >
              {activating ? '...' : 'تفعيل'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
