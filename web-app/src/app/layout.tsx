import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'MA Streaming',
  description: 'منصة بث المحتوى العربي والعالمي',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet" />
        {/* Ad / popup blocker */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){
  /* ── 1. Intercept window.open in this page context ─────────────── */
  var _realOpen = window.open.bind(window);
  window.open = function(url, target, features){
    try {
      if(!url) return null;
      var u = new URL(String(url), location.href);
      var h = u.hostname.toLowerCase();
      var trusted = ['vidsrc.to','vidsrc.cc','vidsrc.me','vidsrc.net',
                     'tmdb.org','image.tmdb.org',
                     'fonts.googleapis.com','fonts.gstatic.com',
                     location.hostname];
      if(trusted.some(function(t){ return h===t||h.endsWith('.'+t); })){
        return _realOpen(url, target, features);
      }
    } catch(e){}
    return null; /* block everything else */
  };

  /* ── 2. Popup-window closer: when page loses focus, close any     ─
          new window that opened and immediately refocus our page      */
  var _lastBlur = 0;
  window.addEventListener('blur', function(){
    var now = Date.now();
    /* debounce: ignore if we blurred less than 800ms ago              */
    if(now - _lastBlur < 800){ _lastBlur = now; return; }
    _lastBlur = now;
    setTimeout(function(){
      /* If focus left our page (to a popup / new tab), bring it back */
      try { window.focus(); } catch(e){}
    }, 50);
  });

  /* ── 3. visibilitychange: page hidden = new tab opened             */
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ setTimeout(function(){ window.focus(); }, 80); }
  });

  /* ── 4. Block parent-page navigation by rogue iframes              */
  window.addEventListener('beforeunload', function(e){
    e.stopImmediatePropagation();
  }, true);

  /* ── 5. Block clicks on obvious ad anchors in THIS document        */
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if(!a) return;
    var href = a.getAttribute('href')||'';
    if(!href||href[0]==='#'||href.startsWith('javascript')) return;
    var external = href.startsWith('http')&&!href.startsWith(location.origin);
    if(external && a.target==='_blank'){
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, true);
})();` }} />
      </head>
      <body className="font-tajawal bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <main className="pt-16">{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
