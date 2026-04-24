'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

interface AuthPromptProps {
  type: 'login' | 'premium';
  onClose?: () => void;
}

export default function AuthPrompt({ type, onClose }: AuthPromptProps) {
  const router = useRouter();

  const handleAction = () => {
    if (type === 'login') {
      router.push('/account');
    } else {
      router.push('/account?tab=premium');
    }
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-gradient-to-br from-light-card to-light-bg dark:from-dark-card dark:to-dark-bg rounded-3xl shadow-2xl border border-light-border dark:border-dark-border overflow-hidden animate-scaleIn">
        
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-10 p-2 rounded-full bg-light-input/80 dark:bg-dark-input/80 hover:bg-light-input dark:hover:bg-dark-input text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text transition backdrop-blur-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Content */}
        <div className="p-8 text-center">
          {type === 'login' ? (
            <>
              {/* Login Icon */}
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-primary to-brand-dark flex items-center justify-center shadow-lg shadow-brand-primary/30">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center border-2 border-light-card dark:border-dark-card">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-black text-light-text dark:text-dark-text mb-3">
                تسجيل الدخول مطلوب
              </h2>
              <p className="text-light-muted dark:text-dark-muted text-sm mb-6 leading-relaxed">
                للوصول إلى هذا المحتوى، يجب عليك تسجيل الدخول أولاً
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAction}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-primary to-brand-dark hover:from-brand-dark hover:to-brand-primary text-black font-bold text-base transition-all shadow-lg shadow-brand-primary/30 hover:shadow-brand-primary/50 hover:scale-[1.02] active:scale-[0.98]"
                >
                  تسجيل الدخول
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-light-input dark:bg-dark-input hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text font-semibold text-sm transition"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Premium Icon */}
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/40 animate-pulse-slow">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-bounce-slow">
                    <span className="text-white text-xs font-black">👑</span>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 mb-3">
                محتوى بريميوم
              </h2>
              <p className="text-light-muted dark:text-dark-muted text-sm mb-6 leading-relaxed">
                هذا المحتوى متاح فقط للمشتركين في الباقة المميزة
              </p>

              {/* Premium Features */}
              <div className="mb-6 space-y-2 text-right">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-light-input/50 dark:bg-dark-input/50">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-brand-dark flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-light-text dark:text-dark-text">مشاهدة بدون إعلانات</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-light-input/50 dark:bg-dark-input/50">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-brand-dark flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-light-text dark:text-dark-text">جودة عالية HD/4K</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-light-input/50 dark:bg-dark-input/50">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-primary to-brand-dark flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-light-text dark:text-dark-text">محتوى حصري</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAction}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold text-base transition-all shadow-lg shadow-yellow-500/40 hover:shadow-yellow-500/60 hover:scale-[1.02] active:scale-[0.98]"
                >
                  ⭐ الترقية للباقة المميزة
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-light-input dark:bg-dark-input hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text font-semibold text-sm transition"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-dark/10 rounded-full blur-3xl -z-10" />
      </div>
    </div>
  );
}
