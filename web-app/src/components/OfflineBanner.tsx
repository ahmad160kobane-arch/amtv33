'use client';
import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const onOffline = () => { setIsOffline(true); setShowRestored(false); };
    const onOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };

    setIsOffline(!navigator.onLine);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!isOffline && !showRestored) return null;

  return (
    <div className={`fixed top-16 left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none`}>
      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold transition-all duration-300 pointer-events-auto ${
        isOffline
          ? 'bg-red-500/95 text-white backdrop-blur-sm'
          : 'bg-green-500/95 text-white backdrop-blur-sm'
      }`}>
        {isOffline ? (
          <>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18" />
            </svg>
            <span>لا يوجد اتصال بالإنترنت</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>تم استعادة الاتصال</span>
          </>
        )}
      </div>
    </div>
  );
}
