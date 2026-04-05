'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { login, register, fetchSubscription } from '@/constants/api';

export default function AccountPage() {
  const { user, loading, refresh, logout } = useAuth();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginField.trim() || !password.trim()) { setError('يرجى ملء جميع الحقول'); return; }
    setError(''); setAuthLoading(true);
    try {
      await login(loginField.trim(), password);
      await refresh();
    } catch (err: any) { setError(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) { setError('يرجى ملء جميع الحقول'); return; }
    setError(''); setAuthLoading(true);
    try {
      await register(username.trim(), email.trim(), password, displayName.trim());
      await refresh();
    } catch (err: any) { setError(err.message); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = async () => { await logout(); };

  const MENU_ITEMS = [
    {
      label: 'سجل المشاهدة', href: '/history',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'المفضلة', href: '/favorites',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    },
    {
      label: 'قائمتي', href: '/mylist',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>,
    },
    {
      label: 'الاشتراك', href: '/subscription',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3l1.5 1.5L8 3l1.5 1.5L11 3l1.5 1.5L14 3l1.5 1.5L17 3l1.5 1.5L20 3v18l-1.5-1.5L17 21l-1.5-1.5L14 21l-1.5-1.5L11 21l-1.5-1.5L8 21l-1.5-1.5L5 21V3z" /></svg>,
    },
  ];

  // Add agent dashboard link for agents/admins
  if (user && (user.role === 'agent' || user.role === 'admin' || user.is_admin)) {
    MENU_ITEMS.push({
      label: 'لوحة الوكيل', href: '/agent',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    const planBadge = user.plan === 'premium'
      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
      : 'bg-dark-input text-dark-muted';

    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-24 md:pb-6">
        <div className="max-w-lg mx-auto px-4">
          {/* Profile header */}
          <div className="pt-6 pb-4 flex flex-col items-center gap-3 mb-4">
            <div className="w-20 h-20 rounded-full bg-brand-primary/20 flex items-center justify-center">
              <span className="text-3xl font-black text-brand-primary">{(user.display_name || user.username).charAt(0).toUpperCase()}</span>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-black text-light-text dark:text-dark-text">{user.display_name || user.username}</h2>
              <p className="text-sm text-light-muted dark:text-dark-muted">{user.email}</p>
              <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold ${planBadge}`}>
                {user.plan === 'premium' ? (
                  <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg> بريميوم</>
                ) : 'مجاني'}
              </div>
            </div>
          </div>

          {/* Stats */}
          {user.stats && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-light-card dark:bg-dark-card rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-brand-primary">{user.stats.watched}</p>
                <p className="text-xs text-light-muted dark:text-dark-muted mt-1">مشاهد</p>
              </div>
              <div className="bg-light-card dark:bg-dark-card rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-brand-primary">{user.stats.favorites}</p>
                <p className="text-xs text-light-muted dark:text-dark-muted mt-1">مفضلة</p>
              </div>
            </div>
          )}

          {/* Menu */}
          <div className="flex flex-col gap-2 mb-5">
            {MENU_ITEMS.map(item => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="flex items-center gap-3 p-4 rounded-xl bg-light-card dark:bg-dark-card hover:bg-light-input dark:hover:bg-dark-input transition text-right"
              >
                <span className="w-8 flex items-center justify-center text-brand-primary">{item.icon}</span>
                <span className="flex-1 font-medium text-sm text-light-text dark:text-dark-text">{item.label}</span>
                <svg className="w-4 h-4 text-light-muted dark:text-dark-muted rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-error/30 text-brand-error hover:bg-brand-error/10 font-medium text-sm transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center px-4 pb-24 md:pb-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <span className="text-4xl font-black text-brand-primary tracking-wide">MA</span>
          <p className="text-sm text-light-muted dark:text-dark-muted mt-1">منصة البث العربي</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-light-input dark:bg-dark-input rounded-xl p-1 mb-6">
          <button onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${isLogin ? 'bg-brand-primary text-black shadow' : 'text-light-muted dark:text-dark-muted'}`}
          >دخول</button>
          <button onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${!isLogin ? 'bg-brand-primary text-black shadow' : 'text-light-muted dark:text-dark-muted'}`}
          >إنشاء حساب</button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm text-center">
            {error}
          </div>
        )}

        {isLogin ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="text" value={loginField} onChange={e => setLoginField(e.target.value)}
              placeholder="اسم المستخدم أو البريد الإلكتروني"
              className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-3 text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-3 pl-10 text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-muted dark:text-dark-muted hover:text-brand-primary transition">
                {showPass ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
            <button
              type="submit" disabled={authLoading}
              className="w-full py-3 rounded-xl bg-brand-primary hover:bg-brand-dark text-black font-bold text-sm transition disabled:opacity-60"
            >
              {authLoading ? 'جارٍ الدخول...' : 'دخول'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="flex flex-col gap-3">
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="الاسم الظاهر (اختياري)"
              className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-3 text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="اسم المستخدم" required
              className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-3 text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" required
              className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-3 text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" required
                className="w-full bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl px-4 py-3 pl-10 text-sm font-medium placeholder:text-light-muted dark:placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40" />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-muted dark:text-dark-muted hover:text-brand-primary transition">
                {showPass ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
            <button type="submit" disabled={authLoading}
              className="w-full py-3 rounded-xl bg-brand-primary hover:bg-brand-dark text-black font-bold text-sm transition disabled:opacity-60">
              {authLoading ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
