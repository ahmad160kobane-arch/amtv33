import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  BackHandler,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import {
  fetchVidsrcDetail,
  VidsrcDetail,
  VidsrcEpisode,
  isLoggedIn,
  checkFavorite,
  toggleFavorite,
  requestVidsrcStream,
  fetchSubscription,
  getSavedUser,
  addWatchHistory,
} from '@/constants/Api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PLAYER_HEIGHT = (SCREEN_W * 9) / 16; // 16:9 aspect ratio
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

// JavaScript — حقن قبل تحميل الصفحة: حظر الإعلانات (NUCLEAR MAXIMUM)
const WEBVIEW_EARLY_JS = `
(function() {
  // ========== 0. إجبار عرض الموبايل ==========
  // إضافة viewport meta tag
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  (document.head || document.documentElement).appendChild(viewport);
  
  // تعيين عرض الشاشة للموبايل
  if (window.screen) {
    Object.defineProperty(window.screen, 'width', { value: 393, writable: false });
    Object.defineProperty(window.screen, 'height', { value: 851, writable: false });
    Object.defineProperty(window.screen, 'availWidth', { value: 393, writable: false });
    Object.defineProperty(window.screen, 'availHeight', { value: 851, writable: false });
  }
  
  // تعيين window.innerWidth/innerHeight
  Object.defineProperty(window, 'innerWidth', { value: 393, writable: false, configurable: false });
  Object.defineProperty(window, 'innerHeight', { value: 851, writable: false, configurable: false });
  Object.defineProperty(window, 'outerWidth', { value: 393, writable: false, configurable: false });
  Object.defineProperty(window, 'outerHeight', { value: 851, writable: false, configurable: false });
  
  // إضافة CSS لإجبار عرض الموبايل
  const mobileStyle = document.createElement('style');
  mobileStyle.textContent = \`
    html, body {
      width: 100vw !important;
      max-width: 100vw !important;
      overflow-x: hidden !important;
      -webkit-text-size-adjust: 100% !important;
      touch-action: manipulation !important;
    }
    
    /* إجبار المشغل على ملء الشاشة */
    video, iframe[src*="vidsrc"], [class*="player"], [id*="player"] {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      object-fit: contain !important;
    }
    
    /* أزرار بحجم مناسب للموبايل */
    button, [role="button"], .button, [class*="btn"], [class*="control"] {
      min-width: 44px !important;
      min-height: 44px !important;
      touch-action: manipulation !important;
    }
    
    /* إخفاء أي عناصر سطح المكتب */
    .desktop-only, [class*="desktop"], .hide-mobile {
      display: none !important;
    }
  \`;
  (document.head || document.documentElement).appendChild(mobileStyle);
  
  // إجبار touch events
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, writable: false });
  Object.defineProperty(navigator, 'msMaxTouchPoints', { value: 5, writable: false });

  const noop = () => {};
  const fakeWin = { focus: noop, blur: noop, close: noop, closed: true, document: { write: noop, writeln: noop }, location: { href: '' } };

  // ========== 1. حظر كامل للنوافذ المنبثقة ==========
  try {
    Object.defineProperty(window, 'open', { value: () => fakeWin, writable: false, configurable: false });
  } catch(e) { window.open = () => fakeWin; }
  window.alert = noop; window.confirm = () => false; window.prompt = () => null;
  window.showModalDialog = noop; window.print = noop;

  // ========== 2. حظر تغيير الموقع (STRICT - vidsrc.to فقط) ==========
  const origLocation = window.location.href;
  const ALLOWED_HOSTS = ['vidsrc.to', 'vidsrc.cc', 'vidsrc.me', 'vidsrc.net'];
  
  const isAllowedUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const u = url.toLowerCase();
    return ALLOWED_HOSTS.some(h => u.includes(h));
  };
  
  // حظر location.href
  try {
    const locDesc = Object.getOwnPropertyDescriptor(window, 'location');
    if (locDesc && locDesc.configurable !== false) {
      let currentHref = window.location.href;
      Object.defineProperty(window, 'location', {
        get: () => {
          const loc = new URL(currentHref);
          loc.assign = (url) => { 
            if (isAllowedUrl(url)) currentHref = url; 
            else console.log('[BLOCKED] location.assign:', url);
          };
          loc.replace = (url) => { 
            if (isAllowedUrl(url)) currentHref = url; 
            else console.log('[BLOCKED] location.replace:', url);
          };
          Object.defineProperty(loc, 'href', {
            get: () => currentHref,
            set: (v) => { 
              if (isAllowedUrl(v)) currentHref = v; 
              else console.log('[BLOCKED] location.href set:', v);
            }
          });
          return loc;
        },
        set: (v) => {
          if (isAllowedUrl(v)) return;
          console.log('[BLOCKED] location set:', v);
        }
      });
    }
  } catch(e) {}

  // حظر document.location
  try {
    Object.defineProperty(document, 'location', {
      get: () => window.location,
      set: (v) => {
        if (!isAllowedUrl(v)) {
          console.log('[BLOCKED] document.location:', v);
          return;
        }
      }
    });
  } catch(e) {}

  // حظر top.location و parent.location
  try {
    if (window.top && window.top !== window) {
      Object.defineProperty(window.top, 'location', {
        get: () => window.location,
        set: noop
      });
    }
    if (window.parent && window.parent !== window) {
      Object.defineProperty(window.parent, 'location', {
        get: () => window.location,
        set: noop
      });
    }
  } catch(e) {}

  // ========== 3. CSS AGGRESSIVE لإخفاء كل الإعلانات ==========
  const style = document.createElement('style');
  style.textContent = \`
    /* إخفاء كل iframes ما عدا المشغل */
    iframe:not([src*="vidsrc"]):not([src*="vidplay"]):not([src*="megacloud"]):not([src*="rabbitstream"]):not([src*="embed"]):not([src*="superembed"]) {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      position: absolute !important;
      width: 0 !important;
      height: 0 !important;
    }
    
    /* إخفاء divs و overlays الإعلانية بقوة */
    div[id*="ad-"]:not([id*="video"]):not([id*="player"]), 
    div[class*="ad-"]:not([class*="video"]):not([class*="player"]), 
    div[id*="ads"]:not([id*="video"]), div[class*="ads"]:not([class*="video"]),
    div[id*="banner"], div[class*="banner"], 
    div[id*="popup"], div[class*="popup"],
    div[id*="modal"]:not([class*="player"]):not([class*="video"]), 
    div[class*="modal"]:not([class*="player"]):not([class*="video"]),
    [class*="taboola"], [class*="outbrain"], [class*="mgid"],
    [id*="taboola"], [id*="outbrain"], [id*="mgid"],
    .ad-showing, .ima-ad-container, .ytp-ad-module, .ytp-ad-overlay-container {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    
    /* إخفاء كل الروابط المطلقة والشفافة */
    a[style*="position: absolute"],
    a[style*="position:absolute"],
    a[href*="jup9"], a[href*="clickynx"], a[href*="popads"], 
    a[href*="adsterra"], a[href*="exoclick"], a[href*="afu.php"],
    a[href*="ymid="], a[href*="zoneid="], a[href*="clickid="] {
      display: none !important;
      pointer-events: none !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
    }
    
    /* إخفاء عناصر التتبع */
    img[width="1"][height="1"], img[src*="pixel"], img[src*="beacon"],
    img[src*="track"], img[src*="analytics"], img[src*="jup9"] {
      display: none !important;
    }
    
    /* منع أي عنصر ثابت بـ z-index عالي */
    div[style*="position: fixed"][style*="z-index"],
    div[style*="position:fixed"][style*="z-index"],
    *[style*="z-index: 999"]:not(video):not([class*="player"]),
    *[style*="z-index:999"]:not(video):not([class*="player"]) {
      display: none !important;
    }
    
    /* إخفاء overlays ليست جزء من المشغل */
    .overlay:not(.vjs-overlay):not([class*="player"]),
    [class*="overlay"]:not([class*="player"]):not([class*="video"]) {
      display: none !important;
    }
  \`;
  (document.head || document.documentElement).appendChild(style);

  // ========== 4. حظر الطلبات الشبكية ==========
  const origFetch = window.fetch;
  window.fetch = function(u) {
    const url = typeof u === 'string' ? u : (u && u.url ? u.url : '');
    if (isAdUrl(url)) return Promise.resolve(new Response('', {status: 204}));
    return origFetch.apply(this, arguments);
  };

  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, url) {
    if (isAdUrl(url)) { this._blocked = true; return; }
    return origXHROpen.apply(this, arguments);
  };
  const origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) return;
    return origXHRSend.apply(this, arguments);
  };

  // حظر WebSocket و Worker و Beacon و Service Workers
  try {
    const OrigWebSocket = window.WebSocket;
    window.WebSocket = function(url) {
      if (isAdUrl(url)) {
        console.log('[AdBlock] Blocked WebSocket:', url);
        return { close: noop, send: noop, addEventListener: noop, readyState: 3 };
      }
      return new OrigWebSocket(url);
    };
    
    if (window.Worker) {
      const OrigWorker = window.Worker;
      window.Worker = function(url) {
        if (typeof url === 'string' && isAdUrl(url)) {
          console.log('[AdBlock] Blocked Worker:', url);
          return { postMessage: noop, terminate: noop, addEventListener: noop };
        }
        return new OrigWorker(url);
      };
    }
    
    navigator.sendBeacon = (url) => {
      if (isAdUrl(url)) { console.log('[AdBlock] Blocked Beacon:', url); return true; }
      return true;
    };
    
    // حظر Service Worker للإعلانات
    if (navigator.serviceWorker) {
      const origRegister = navigator.serviceWorker.register;
      navigator.serviceWorker.register = function(url) {
        if (isAdUrl(url)) {
          console.log('[AdBlock] Blocked ServiceWorker:', url);
          return Promise.reject(new Error('Blocked'));
        }
        return origRegister.apply(this, arguments);
      };
    }
  } catch(e) {}

  // ========== 5. حظر إنشاء العناصر الإعلانية ==========
  const origCreate = document.createElement.bind(document);
  document.createElement = function(tag) {
    const el = origCreate(tag);
    const t = tag.toLowerCase();
    if (t === 'script' || t === 'iframe' || t === 'embed' || t === 'object') {
      const origSet = el.setAttribute.bind(el);
      el.setAttribute = function(n, v) {
        if (n === 'src' && isAdUrl(v)) { console.log('[AdBlock] Blocked src:', v); return; }
        return origSet(n, v);
      };
      Object.defineProperty(el, 'src', {
        set: (v) => { if (!isAdUrl(v)) origSet('src', v); else console.log('[AdBlock] Blocked src set:', v); },
        get: () => el.getAttribute('src'),
        configurable: true
      });
    }
    return el;
  };

  // حظر appendChild و insertBefore للسكربتات
  const origAppend = Node.prototype.appendChild;
  Node.prototype.appendChild = function(node) {
    if (node && node.tagName) {
      const tag = node.tagName.toLowerCase();
      if ((tag === 'script' || tag === 'iframe') && node.src && isAdUrl(node.src)) {
        console.log('[AdBlock] Blocked appendChild:', node.src);
        return node;
      }
    }
    return origAppend.call(this, node);
  };

  // ========== 6. حظر مستمعات الأحداث المشبوهة ==========
  const suspiciousEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'contextmenu', 'auxclick'];
  const isSuspicious = (fn) => {
    if (!fn) return false;
    const s = fn.toString().toLowerCase();
    const suspiciousPatterns = [
      'window.open', 'location.href', 'location.assign', 'location.replace',
      '.click()', 'popup', 'redirect', 'popunder', 'window.location',
      'document.location', 'top.location', 'parent.location', 'self.location',
      'clickunder', 'newwindow', 'openwindow', 'showmodal', 'createpopup',
      'adserv', 'adsystem', 'tracking', 'analytics', 'pixel'
    ];
    return suspiciousPatterns.some(p => s.includes(p));
  };

  const origAddEvent = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, fn, opts) {
    if (suspiciousEvents.includes(type) && isSuspicious(fn)) {
      console.log('[AdBlock] Blocked suspicious listener:', type);
      return;
    }
    return origAddEvent.call(this, type, fn, opts);
  };
  
  // حظر onclick attributes المشبوهة
  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (name.toLowerCase() === 'onclick' && typeof value === 'string') {
      const v = value.toLowerCase();
      if (v.includes('window.open') || v.includes('location') || v.includes('popup')) {
        console.log('[AdBlock] Blocked onclick attribute');
        return;
      }
    }
    return origSetAttr.call(this, name, value);
  };

  // ========== 7. حظر النقرات على الروابط الخارجية ==========
  document.addEventListener('click', function(e) {
    const target = e.target;
    if (!target) return;
    
    // السماح بالنقر على عناصر المشغل والتحكم
    if (target.closest('video') || target.closest('.jw-') || 
        target.closest('.vjs-') || target.closest('.plyr') ||
        target.closest('[class*="player"]') || target.closest('[class*="control"]')) {
      return;
    }
    
    // فحص الروابط
    const href = target.href || target.closest('a')?.href;
    if (href) {
      const lowerHref = href.toLowerCase();
      
      // حظر نطاقات الإعلانات
      if (blockedHosts.some(h => lowerHref.includes(h))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('[AdBlock] Blocked click on ad link');
        return false;
      }
      
      // حظر الروابط الخارجية (غير المشغل)
      if (!safeHosts.some(h => lowerHref.includes(h))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('[AdBlock] Blocked external link');
        return false;
      }
    }
  }, true);

  // ========== 8. إزالة عدوانية للعناصر الإعلانية ==========
  const cleanAds = () => {
    // إزالة كل iframes ما عدا المشغل
    document.querySelectorAll('iframe').forEach(iframe => {
      const src = (iframe.src || '').toLowerCase();
      const allowedDomains = ['vidsrc', 'vidplay', 'megacloud', 'rabbitstream', 'embed', 'superembed'];
      if (!allowedDomains.some(d => src.includes(d))) {
        iframe.remove();
      }
    });
    
    // إزالة الروابط الإعلانية
    document.querySelectorAll('a[href*="jup9"], a[href*="clickynx"], a[href*="popads"], a[href*="adsterra"], a[href*="exoclick"], a[href*="afu.php"]').forEach(a => {
      a.remove();
    });
    
    // إزالة divs إعلانية
    document.querySelectorAll('[id*="ad-"], [class*="ad-"], [id*="popup"], [class*="popup"], [id*="banner"]').forEach(el => {
      if (!el.closest('video') && !el.querySelector('video') && 
          !el.closest('[class*="player"]') && !el.querySelector('[class*="player"]')) {
        el.remove();
      }
    });
    
    // إزالة onclick المشبوهة
    document.querySelectorAll('a[onclick], div[onclick]').forEach(el => {
      const onclick = el.getAttribute('onclick') || '';
      const lc = onclick.toLowerCase();
      if (lc.includes('window.open') || lc.includes('popup') || lc.includes('redirect')) {
        el.removeAttribute('onclick');
        el.style.pointerEvents = 'none';
      }
    });
    
    // إزالة عناصر ثابتة بـ z-index عالي
    document.querySelectorAll('div, a').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' && parseInt(style.zIndex) > 900) {
        if (!el.closest('video') && !el.querySelector('video') && 
            !el.closest('[class*="player"]')) {
          el.remove();
        }
      }
    });
  };
  
  // تشغيل التنظيف بشكل عدواني
  cleanAds();
  setInterval(cleanAds, 500);
  document.addEventListener('DOMContentLoaded', cleanAds);

  // ========== 8. حظر eval و Function للسكربتات الإعلانية ==========
  try {
    const origEval = window.eval;
    window.eval = function(code) {
      if (typeof code === 'string') {
        const lc = code.toLowerCase();
        if (lc.includes('window.open') || lc.includes('popunder') || lc.includes('clickunder')) {
          console.log('[AdBlock] Blocked eval ad script');
          return undefined;
        }
      }
      return origEval.call(window, code);
    };
  } catch(e) {}
  
  // ========== 9. حظر document.write للإعلانات ==========
  try {
    const origWrite = document.write.bind(document);
    const origWriteln = document.writeln.bind(document);
    document.write = function(content) {
      if (typeof content === 'string' && isAdUrl(content)) {
        console.log('[AdBlock] Blocked document.write ad');
        return;
      }
      return origWrite(content);
    };
    document.writeln = function(content) {
      if (typeof content === 'string' && isAdUrl(content)) {
        console.log('[AdBlock] Blocked document.writeln ad');
        return;
      }
      return origWriteln(content);
    };
  } catch(e) {}

  console.log('[AdBlock] NUCLEAR ad blocker loaded - ALL ADS BLOCKED');
  true;
})();
`;

// JavaScript — حقن بعد تحميل الصفحة: تشغيل تلقائي وإبلاغ التطبيق
const WEBVIEW_INJECT_JS = `
(function() {
  let videoStarted = false;
  let retryCount = 0;

  // تشغيل الفيديو تلقائياً
  function forceAutoplay() {
    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return false;
    
    videos.forEach(v => {
      // إعدادات التشغيل التلقائي
      v.autoplay = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('autoplay', '');
      v.preload = 'auto';
      
      if (v.paused) {
        // محاولة التشغيل بدون كتم الصوت أولاً
        v.muted = false;
        v.volume = 1;
        
        const playPromise = v.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            videoStarted = true;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_playing' }));
          }).catch(() => {
            // إذا فشل، جرب مع كتم الصوت ثم ارفع الصوت
            v.muted = true;
            v.play().then(() => {
              videoStarted = true;
              setTimeout(() => { 
                v.muted = false; 
                v.volume = 1; 
              }, 300);
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_playing' }));
            }).catch(() => {});
          });
        }
      } else {
        videoStarted = true;
      }
    });
    return videoStarted;
  }

  // النقر على أزرار التشغيل
  function clickPlayButtons() {
    const selectors = [
      '.vjs-big-play-button', 
      '.jw-icon-playback', 
      '[class*="play-button"]',
      '[class*="play-btn"]', 
      '[class*="playBtn"]',
      '[aria-label*="play" i]', 
      '[title*="play" i]',
      'button[class*="play"]',
      '.plyr__control--overlaid',
      '.ytp-large-play-button',
      '[data-testid="play-button"]',
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        try { 
          if (btn.offsetParent !== null && btn.offsetWidth > 0) {
            btn.click(); 
          }
        } catch(e) {}
      });
    });
  }

  // إزالة أي عناصر تمنع التشغيل
  function removeBlockers() {
    const blockers = [
      '.overlay:not(.vjs-overlay)',
      '.modal:not([class*="player"])',
      '[class*="ad-overlay"]',
      '[class*="play-overlay"]',
    ];
    blockers.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.closest('video') && !el.querySelector('video')) {
          el.style.display = 'none';
        }
      });
    });
  }

  // المحاولة الرئيسية
  function tryAutoplay() {
    if (videoStarted || retryCount >= 30) return;
    retryCount++;
    
    removeBlockers();
    clickPlayButtons();
    forceAutoplay();
    
    if (!videoStarted) {
      setTimeout(tryAutoplay, 300);
    }
  }

  // بدء المحاولات فوراً
  tryAutoplay();
  
  // محاولة عند تحميل DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryAutoplay);
  } else {
    tryAutoplay();
  }
  
  window.addEventListener('load', tryAutoplay);

  // مراقبة الفيديوهات الجديدة
  const observer = new MutationObserver(() => {
    if (!videoStarted) {
      const video = document.querySelector('video');
      if (video) {
        removeBlockers();
        clickPlayButtons();
        forceAutoplay();
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // إبلاغ التطبيق عند تشغيل الفيديو
  document.addEventListener('play', function(e) {
    if (e.target && e.target.tagName === 'VIDEO') {
      videoStarted = true;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_playing' }));
    }
  }, true);

  // إبلاغ التطبيق عند تغيير وضع ملء الشاشة
  document.addEventListener('fullscreenchange', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'fullscreen',
      isFullscreen: !!document.fullscreenElement
    }));
  });

  // فحص دوري كل 500ms
  const interval = setInterval(() => {
    if (videoStarted) { 
      clearInterval(interval); 
      return; 
    }
    tryAutoplay();
  }, 500);
  
  // إيقاف بعد 60 ثانية
  setTimeout(() => clearInterval(interval), 60000);

  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'page_ready' }));
  true;
})();
`;

export default function DetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    imdbId?: string;
    tmdbId?: string;
    type?: string; // 'movie' | 'tv' | 'channel'
    title?: string;
    poster?: string;
    channelId?: string;
    channelLogo?: string;
  }>();

  const isChannel = params.type === 'channel';
  const isVod = !isChannel;

  const [detail, setDetail] = useState<VidsrcDetail | null>(null);
  const [episodes, setEpisodes] = useState<VidsrcEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [descExpanded, setDescExpanded] = useState(false);
  const scrollRef = useRef<any>(null);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [playerError, setPlayerError] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [canWatch, setCanWatch] = useState(false);
  const [isLoggedInUser, setIsLoggedInUser] = useState(false);
  const webviewRef = useRef<WebView>(null);
  const historyRecordedRef = useRef<string>('');

  const contentId = params.tmdbId || params.imdbId || params.id;

  const loadData = useCallback(async () => {
    try {
      if (isVod && contentId) {
        const vType = (params.type === 'tv' || params.type === 'series') ? 'tv' : 'movie';
        const data = await fetchVidsrcDetail(vType as 'movie' | 'tv', contentId);
        if (data) {
          setDetail(data);
          if (data.episodes && data.episodes.length > 0) {
            setEpisodes(data.episodes);
            if (data.seasons && data.seasons.length > 0) {
              setSelectedSeason(data.seasons[0]);
            }
          }
        }
        const loggedIn = await isLoggedIn();
        setIsLoggedInUser(loggedIn);
        if (loggedIn) {
          const [fav, sub, savedUser] = await Promise.all([
            checkFavorite(contentId, 'vod'),
            fetchSubscription(),
            getSavedUser(),
          ]);
          setIsFav(fav);
          const premium = sub?.isPremium ?? false;
          const role = savedUser?.role || 'user';
          const isPrivileged = role === 'admin' || role === 'agent';
          setIsPremium(premium);
          setCanWatch(premium || isPrivileged);
        }
      } else if (isChannel && params.channelId) {
        const loggedIn = await isLoggedIn();
        if (loggedIn) {
          const fav = await checkFavorite(params.channelId, 'channel');
          setIsFav(fav);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [contentId, params.channelId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Fetch embed URL - استخدام المصادر مباشرة مع دعم الاحتياطي
  const prevKeyRef = useRef('');
  useEffect(() => {
    if (!isVod || !contentId) return;
    
    const vType = (params.type === 'tv' || params.type === 'series') ? 'tv' : 'movie';
    const key = `${vType}_${contentId}_${currentSeason}_${currentEpisode}`;
    
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    
    setPlayerLoading(true);
    setPlayerError(false);
    
    // استخدام vidsrc.to فقط
    const embed = vType === 'tv'
      ? `https://vidsrc.to/embed/tv/${contentId}/${currentSeason}/${currentEpisode}`
      : `https://vidsrc.to/embed/movie/${contentId}`;
    
    console.log(`[Player] Loading: ${embed}`);
    setEmbedUrl(embed);
  }, [contentId, currentSeason, currentEpisode, isVod, params.type]);

  // Screen orientation handling
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // Handle back button for fullscreen
  useEffect(() => {
    if (!isVod) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFullscreen && webviewRef.current) {
        webviewRef.current.injectJavaScript('document.exitFullscreen && document.exitFullscreen(); true;');
        setIsFullscreen(false);
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [isVod, isFullscreen]);

  // WebView message handler
  const onWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'fullscreen') {
        setIsFullscreen(data.isFullscreen);
        if (data.isFullscreen) {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT).catch(() => {});
        } else {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        }
      } else if (data.type === 'video_playing' || data.type === 'page_ready') {
        setPlayerLoading(false);
      }
    } catch {}
  };

  // Block ad redirects at native level - COMPREHENSIVE BLOCKING
  const AD_DOMAINS_BLOCK = [
    // مواقع البالغين
    'gloporn.com', 'hadesex.com', 'topsites.hadesex.com',
    'pornhub.com', 'xvideos.com', 'xhamster.com', 'redtube.com', 'youporn.com', 'tube8.com',
    'livejasmin.com', 'chaturbate.com', 'stripchat.com', 'bongacams.com', 'cam4.com', 'camsoda.com',
    'spankbang.com', 'xnxx.com', 'beeg.com', 'brazzers.com', 'myfreecams.com',
    // شبكات الإعلانات الرئيسية
    'popads.net', 'popcash.net', 'propellerads.com', 'propeller.com', 'adsterra.com',
    'exoclick.com', 'juicyads.com', 'trafficjunky.com', 'trafficstars.com', 'hilltopads.com',
    'clickadu.com', 'clickaine.com', 'adcash.com', 'admaven.com', 'plugrush.com',
    // Google Ads
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'googleads.g.doubleclick.net',
    'pagead2.googlesyndication.com', 'adservice.google.com', 'www.googletagmanager.com',
    // شبكات إعلانية أخرى
    'onclickmax.com', 'onclickalgo.com', 'onclickads.net', 'pushnow.net', 'richpush.co', 'richpush.net',
    'pushground.com', 'webpushr.com', 'subscribers.com', 'onesignal.com',
    'bidvertiser.com', 'infolinks.com', 'media.net', 'adversal.com', 'yllix.com', 'revenuehits.com',
    'mgid.com', 'revcontent.com', 'taboola.com', 'outbrain.com', 'content.ad',
    // روابط مختصرة إعلانية
    'adf.ly', 'shorte.st', 'linkbucks.com', 'sh.st', 'bc.vc', 'adfoc.us', 'adfly.com',
    // نطاقات مشبوهة
    'twistyfunnels.com', 'vialotadom.com', 'astronautlividlyreformer.com',
    'pothertion.com', 'viicmkru.com', 'performet.qpon', 'zeroredirect.com',
    // شبكات تتبع وتحليل
    'afftrack.com', 'go2cloud.org', 'appsflyer.com', 'adjust.com', 'voluum.com', 'clickmeter.com',
    // شبكات RTB
    'adnxs.com', 'adsrvr.org', 'adform.net', 'smartadserver.com', 'criteo.com', 'criteo.net',
    'pubmatic.com', 'openx.net', 'rubiconproject.com', 'spotxchange.com', 'teads.tv',
    'amazon-adsystem.com', 'moatads.com', 'doubleverify.com', 'adsafeprotected.com',
    // Mining
    'coinhive.com', 'cryptoloot.pro', 'coin-hive.com', 'minero.cc', 'webminer.com',
  ];
  const ALLOWED_DOMAINS = [
    'vidsrc.to', 'vidsrc.me', 'vidsrc.cc', 'vidsrc.net', 'vidsrc.xyz',
    'vidplay.site', 'vidplay.online', 'megacloud.tv', 'rabbitstream.net', 'dokicloud.one',
    'tmdb.org', 'themoviedb.org', 'image.tmdb.org',
    'embed.su', 'superembed.stream', 'autoembed.cc', 'vidlink.pro', '2embed.cc', 'moviesapi.club'
  ];
  
  const onShouldStartLoad = (request: { url: string; isTopFrame?: boolean; mainDocumentURL?: string }): boolean => {
    try {
      const url = (request.url || '').toLowerCase();
      if (!url) return true;

      // دائماً السماح: blob, data, about
      if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('about:')) return true;

      // دائماً السماح بملفات الميديا والترجمة
      if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('.webm') ||
          url.includes('.ts') || url.includes('.vtt') || url.includes('.srt')) return true;

      // حظر نطاقات الإعلانات المعروفة لجميع الإطارات
      if (AD_DOMAINS_BLOCK.some(d => url.includes(d))) return false;

      // السماح بكل طلبات الموارد الفرعية (CDN، سكربتات المشغل، صور)
      // فقط الملاحة في الإطار الرئيسي تخضع للفحص الصارم
      if (request.isTopFrame === false) return true;

      // للملاحة في الإطار الرئيسي، السماح فقط بنطاقات المشغل المعروفة
      const PLAYER_DOMAINS = [
        'vidsrc.to', 'vidsrc.cc', 'vidsrc.me', 'vidsrc.net', 'vidsrc.xyz',
        '2embed.cc', 'embed.su', 'autoembed.cc', 'multiembed.mov',
        'superembed.stream', 'vidplay', 'megacloud', 'rabbitstream',
        'filemoon', 'streamwish', 'vidlink.pro', 'moviesapi.club',
        'dokicloud', 'smashystream', 'embedsoap', 'embedrise',
        'frembed', 'gomostream', 'aniwave', 'zoroxtv',
      ];
      if (PLAYER_DOMAINS.some(d => url.includes(d))) return true;

      console.log('[Block] Blocked top-frame nav:', url.substring(0, 80));
      return false;
    } catch {
      return true;
    }
  };

  const handleToggleFav = async () => {
    const loggedIn = await isLoggedIn();
    if (!loggedIn || favLoading) return;
    setFavLoading(true);
    try {
      const itemId = isChannel ? params.channelId! : (contentId || detail?.tmdb_id || '');
      const itemType = isChannel ? 'channel' : 'vod';
      const result = await toggleFavorite(itemId, itemType, isChannel ? undefined : {
        title: detail?.title || params.title || '',
        poster: detail?.poster || params.poster || '',
        content_type: detail?.vod_type === 'series' ? 'tv' : (params.type || 'movie'),
      });
      setIsFav(result);
    } catch {}
    setFavLoading(false);
  };

  // Play episode (for series) - update embedded player
  const playEpisode = (season: number, episode: number) => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);
    setSelectedSeason(season);
    setPlayerLoading(true);
  };

  // Handle channel play (goes to live player)
  const handleChannelPlay = () => {
    router.push({ pathname: '/player', params: { channelId: params.channelId, title: params.title } });
  };

  const title = params.title || detail?.title || '';
  const poster = params.poster || detail?.poster || '';
  const description = detail?.description || '';
  const year = detail?.year || '';
  const vodType = detail?.vod_type || (params.type === 'tv' ? 'series' : params.type);
  const isSeries = vodType === 'series' || params.type === 'tv';
  const genre = detail?.genre || detail?.genres?.join(', ') || '';
  const cast = detail?.cast || '';
  const director = detail?.director || '';
  const country = detail?.country || '';
  const runtime = detail?.runtime || '';
  const imdbRating = detail?.rating || '';

  const seasons = detail?.seasons || [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b);
  const seasonEpisodes = episodes.filter((e) => e.season === selectedSeason);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar hidden={isFullscreen} barStyle="light-content" backgroundColor="#000" translucent={false} />
      
      {/* Loading state - show poster backdrop while data loads */}
      {isVod && loading && (
        <View style={[styles.playerSection, { marginTop: STATUS_BAR_HEIGHT, backgroundColor: '#000' }]}>
          {poster ? (
            <Image source={{ uri: poster }} style={styles.playerWebview} resizeMode="cover" />
          ) : null}
          <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
          <ActivityIndicator size="large" color={Colors.brand.primary} style={{ position: 'absolute' }} />
        </View>
      )}

      {/* Gate - shown when VOD content but not allowed */}
      {isVod && !canWatch && !loading ? (
        <View style={[styles.playerSection, styles.premiumGateSection, { marginTop: STATUS_BAR_HEIGHT }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
          {!isLoggedInUser ? (
            <>
              <Ionicons name="person-circle-outline" size={52} color="rgba(255,255,255,0.6)" />
              <Text style={styles.premiumGateTitle}>يجب تسجيل الدخول</Text>
              <Text style={styles.premiumGateDesc}>سجّل دخولك واشترك ببريميوم لمشاهدة هذا المحتوى</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/account' as any)} activeOpacity={0.82}>
                <LinearGradient colors={Colors.brand.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.subscribeBtnDetail}>
                  <Ionicons name="log-in-outline" size={16} color="#fff" />
                  <Text style={styles.subscribeBtnText}>تسجيل الدخول</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons name="diamond" size={52} color="#FFD700" />
              <Text style={styles.premiumGateTitle}>اشتراك بريميوم مطلوب</Text>
              <Text style={styles.premiumGateDesc}>هذا المحتوى حصري للمشتركين بريميوم</Text>
              <TouchableOpacity onPress={() => router.push('/subscription' as any)} activeOpacity={0.82}>
                <LinearGradient colors={['#6C3DE0', '#9F6FF5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.subscribeBtnDetail}>
                  <Ionicons name="diamond-outline" size={16} color="#fff" />
                  <Text style={styles.subscribeBtnText}>اشترك الآن</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}

      {/* WebView Player - ALWAYS rendered, style changes based on fullscreen */}
      {isVod && embedUrl && canWatch ? (
        <View style={[styles.playerSection, { marginTop: STATUS_BAR_HEIGHT }]}>
          <WebView
            ref={webviewRef}
            key={embedUrl}
            source={{ uri: embedUrl }}
            style={[styles.playerWebview, { backgroundColor: '#000' }]}
            onLoadStart={() => setPlayerLoading(true)}
            onLoadEnd={() => {
              setPlayerLoading(false);
              // Record watch history once per content item
              const historyKey = `${contentId}_${currentSeason}_${currentEpisode}`;
              if (historyKey !== historyRecordedRef.current && isLoggedInUser && contentId) {
                historyRecordedRef.current = historyKey;
                const vType = (params.type === 'tv' || params.type === 'series') ? 'tv' : 'movie';
                addWatchHistory({
                  item_id: String(contentId),
                  item_type: 'vod',
                  title: title || '',
                  poster: poster || '',
                  content_type: vType === 'tv' ? 'series' : 'movie',
                });
              }
            }}
            onError={(e) => {
              // Ignore errors from blocked ad URLs
              const url = e.nativeEvent.url || '';
              if (AD_DOMAINS_BLOCK.some(d => url.includes(d)) || url.includes('spot_id=')) {
                console.log('[AdBlock] Ignored error from blocked URL:', url);
                return;
              }
              setPlayerError(true);
              console.log('[Player] Error loading video');
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.log(`[Player] HTTP Error ${nativeEvent.statusCode}`);
              if (nativeEvent.statusCode >= 400) {
                setPlayerError(true);
              }
            }}
            onMessage={onWebViewMessage}
            onShouldStartLoadWithRequest={onShouldStartLoad}
            onNavigationStateChange={(navState) => {
              // Block navigation to ad domains
              const url = (navState.url || '').toLowerCase();
              if (AD_DOMAINS_BLOCK.some(d => url.includes(d))) {
                console.log('[AdBlock] Blocked navigation:', url.substring(0, 80));
                if (webviewRef.current) {
                  webviewRef.current.stopLoading();
                }
              }
            }}
            injectedJavaScriptBeforeContentLoaded={WEBVIEW_EARLY_JS}
            injectedJavaScript={WEBVIEW_INJECT_JS}
            injectedJavaScriptForMainFrameOnly={false}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            setSupportMultipleWindows={false}
            mixedContentMode="always"
            bounces={false}
            overScrollMode="never"
            scalesPageToFit={false}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            cacheEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            originWhitelist={['*']}
            renderToHardwareTextureAndroid
            androidLayerType="hardware"
            userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
          />

          {/* زر الرجوع */}
          <TouchableOpacity style={styles.backBtn} onPress={() => {
            if (isFullscreen && webviewRef.current) {
              webviewRef.current.injectJavaScript('if(document.exitFullscreen)document.exitFullscreen();if(document.webkitExitFullscreen)document.webkitExitFullscreen(); true;');
              setIsFullscreen(false);
              ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
            } else {
              router.back();
            }
          }}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>

          {playerLoading && !playerError && (
            <View style={styles.playerOverlay}>
              <ActivityIndicator size="large" color={Colors.brand.primary} />
            </View>
          )}

          {playerError && (
            <View style={styles.playerOverlay}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={styles.errorText}>فشل تحميل الفيديو</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => {
                setPlayerError(false);
                setPlayerLoading(true);
                setEmbedUrl('');
                setTimeout(() => {
                  const vType = (params.type === 'tv' || params.type === 'series') ? 'tv' : 'movie';
                  const embed = vType === 'tv'
                    ? `https://vidsrc.to/embed/tv/${contentId}/${currentSeason}/${currentEpisode}`
                    : `https://vidsrc.to/embed/movie/${contentId}`;
                  setEmbedUrl(embed);
                }, 100);
              }}>
                <Text style={styles.retryText}>إعادة المحاولة</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : isChannel && !isFullscreen ? (
        /* Channel: Show backdrop with play button */
        <View style={[styles.channelHeader, { marginTop: STATUS_BAR_HEIGHT }]}>
          {params.channelLogo ? (
            <Image source={{ uri: params.channelLogo }} style={styles.channelLogo} resizeMode="contain" />
          ) : null}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.channelPlayBtn} onPress={handleChannelPlay} activeOpacity={0.85}>
            <LinearGradient colors={Colors.brand.gradient} style={styles.channelPlayBtnGrad}>
              <Ionicons name="play" size={32} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Content scroll */}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} style={styles.contentScroll} pointerEvents={isFullscreen ? 'none' : 'auto'}>
        {/* Title & Info */}
        <View style={[styles.infoSection, { direction: 'rtl' }]}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{title}</Text>
          <View style={styles.metaRow}>
            {isSeries && (
              <View style={styles.nowPlayingBadge}>
                <Ionicons name="play-circle" size={14} color={Colors.brand.primary} />
                <Text style={styles.nowPlayingText}>S{currentSeason} E{currentEpisode}</Text>
              </View>
            )}
            {imdbRating ? (
              <View style={styles.ratingChip}>
                <Ionicons name="star" size={12} color="#FFB800" />
                <Text style={styles.ratingChipText}>{imdbRating}</Text>
              </View>
            ) : null}
            {year ? <Text style={[styles.metaChip, { color: colors.textSecondary, backgroundColor: colors.inputBackground }]}>{year}</Text> : null}
            {runtime ? <Text style={[styles.metaChip, { color: colors.textSecondary, backgroundColor: colors.inputBackground }]}>{runtime}</Text> : null}
            {isChannel && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>مباشر</Text>
              </View>
            )}
            {vodType === 'movie' && <Text style={[styles.typeBadgeText, { color: Colors.brand.primary }]}>فيلم</Text>}
            {isSeries && <Text style={[styles.typeBadgeText, { color: '#6366F1' }]}>مسلسل</Text>}
          </View>
          {genre ? (
            <View style={[styles.metaRow, { marginTop: 8 }]}>
              {genre.split(',').map((g, i) => (
                <Text key={i} style={[styles.genreChip, { color: colors.textSecondary, backgroundColor: colors.inputBackground }]}>{g.trim()}</Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Description — shown immediately after title/metadata (Netflix-style) */}
        {description ? (
          <View style={styles.descSection}>
            <Text
              style={[styles.descText, { color: colors.textSecondary }]}
              numberOfLines={descExpanded ? undefined : 3}
            >{description}</Text>
            {description.length > 120 && (
              <TouchableOpacity onPress={() => setDescExpanded(v => !v)} style={styles.descToggle} activeOpacity={0.7}>
                <Text style={styles.descToggleText}>{descExpanded ? 'عرض أقل' : 'قراءة المزيد'}</Text>
                <Ionicons name={descExpanded ? 'chevron-up' : 'chevron-down'} size={13} color={Colors.brand.primary} />
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={[styles.actionsRow, { direction: 'rtl' }]}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: isFav ? 'rgba(239,68,68,0.12)' : colors.cardBackground }]} onPress={handleToggleFav} activeOpacity={0.7} disabled={favLoading}>
            {favLoading ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#EF4444' : colors.textSecondary} />
            )}
            <Text style={[styles.actionBtnText, { color: isFav ? '#EF4444' : colors.textSecondary }]}>
              {isFav ? 'مفضل' : 'مفضلة'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.cardBackground }]}
            onPress={() => Share.share({ message: `${title}${year ? ' (' + year + ')' : ''}`, title })}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social-outline" size={22} color={colors.textSecondary} />
            <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>مشاركة</Text>
          </TouchableOpacity>
        </View>

        {/* Cast & Crew */}
        {(cast || director || country) ? (
          <View style={[styles.detailsGrid, { direction: 'rtl' }]}>
            {director ? (
              <View style={styles.detailItem}>
                <Ionicons name="videocam-outline" size={16} color={Colors.brand.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>المخرج</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{director}</Text>
                </View>
              </View>
            ) : null}
            {cast ? (
              <View style={styles.detailItem}>
                <Ionicons name="people-outline" size={16} color={Colors.brand.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>الممثلين</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={3}>{cast}</Text>
                </View>
              </View>
            ) : null}
            {country ? (
              <View style={styles.detailItem}>
                <Ionicons name="globe-outline" size={16} color={Colors.brand.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>البلد</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{country}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Episodes for series */}
        {isSeries && episodes.length > 0 && (
          <View style={[styles.episodesSection, { direction: 'rtl' }]}>
            <Text style={[styles.descTitle, { color: colors.text }]}>
              الحلقات ({seasonEpisodes.length || episodes.length})
            </Text>

            {/* Season tabs */}
            {seasons.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonTabs} contentContainerStyle={styles.seasonTabsContent}>
                {seasons.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.seasonTab, { backgroundColor: selectedSeason === s ? Colors.brand.primary : colors.inputBackground }]}
                    onPress={() => setSelectedSeason(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.seasonTabText, { color: selectedSeason === s ? '#fff' : colors.textSecondary }]}>
                      الموسم {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Episode list */}
            {(seasons.length > 1 ? seasonEpisodes : episodes).map((ep, index) => {
              const isPlaying = ep.season === currentSeason && ep.episode === currentEpisode;
              return (
                <TouchableOpacity
                  key={ep.id + '_' + index}
                  style={[
                    styles.episodeCard, 
                    { backgroundColor: colors.cardBackground },
                    isPlaying && styles.episodeCardActive
                  ]}
                  onPress={() => playEpisode(ep.season, ep.episode)}
                  activeOpacity={0.8}
                >
                  <LinearGradient 
                    colors={isPlaying ? Colors.brand.gradient : [colors.inputBackground, colors.inputBackground]} 
                    style={styles.epNumber}
                  >
                    {isPlaying ? (
                      <Ionicons name="play" size={14} color="#fff" />
                    ) : (
                      <Text style={[styles.epNumberText, { color: colors.text }]}>{ep.episode || index + 1}</Text>
                    )}
                  </LinearGradient>
                  <View style={styles.epInfo}>
                    <Text style={[styles.epTitle, { color: isPlaying ? Colors.brand.primary : colors.text }]} numberOfLines={2}>
                      {ep.title || `الحلقة ${ep.episode || index + 1}`}
                    </Text>
                    {seasons.length > 1 && (
                      <Text style={[styles.epMeta, { color: colors.textSecondary }]}>S{ep.season}E{ep.episode}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={Colors.brand.primary} />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  // Fullscreen player - takes entire screen
  fullscreenPlayer: { 
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000',
    zIndex: 999,
  },
  
  // Normal player section
  playerSection: { 
    width: '100%', 
    height: PLAYER_HEIGHT, 
    backgroundColor: '#000',
    position: 'relative',
  },
  playerWebview: { width: '100%', height: '100%' },
  playerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Channel header
  channelHeader: {
    width: '100%',
    height: PLAYER_HEIGHT,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  channelLogo: { width: 120, height: 80 },
  channelPlayBtn: {
    position: 'absolute',
    width: 64, height: 64, borderRadius: 32,
    overflow: 'hidden',
  },
  channelPlayBtnGrad: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  
  backBtn: {
    position: 'absolute', top: 12, left: 12, zIndex: 10,
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  
  contentScroll: { flex: 1 },
  infoSection: { padding: 16 },
  title: { fontFamily: Colors.fonts.bold, fontSize: 20, marginBottom: 8, lineHeight: 28 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  metaChip: { fontFamily: Colors.fonts.regular, fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  typeBadgeText: { fontFamily: Colors.fonts.bold, fontSize: 12 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontFamily: Colors.fonts.bold, color: '#EF4444', fontSize: 11 },
  
  nowPlayingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,184,0,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  nowPlayingText: { fontFamily: Colors.fonts.bold, color: Colors.brand.primary, fontSize: 12 },

  // Actions
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
  actionBtnText: { fontFamily: Colors.fonts.medium, fontSize: 12 },

  // Description
  descSection: { paddingHorizontal: 16, marginBottom: 16 },
  descTitle: { fontFamily: Colors.fonts.bold, fontSize: 15, marginBottom: 8 },
  descText: { fontFamily: Colors.fonts.regular, fontSize: 13, lineHeight: 22 },
  descToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  descToggleText: { fontFamily: Colors.fonts.medium, fontSize: 12, color: Colors.brand.primary },

  // Rating chip
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,184,0,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ratingChipText: { fontFamily: Colors.fonts.bold, color: '#FFB800', fontSize: 12 },
  genreChip: { fontFamily: Colors.fonts.regular, fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },

  // Details grid
  detailsGrid: { paddingHorizontal: 16, marginBottom: 16, gap: 12 },
  detailItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  detailLabel: { fontFamily: Colors.fonts.medium, fontSize: 11, marginBottom: 2 },
  detailValue: { fontFamily: Colors.fonts.regular, fontSize: 12, lineHeight: 18 },

  // Episodes
  episodesSection: { marginTop: 8 },
  seasonTabs: { marginBottom: 12 },
  seasonTabsContent: { paddingHorizontal: 16, gap: 8 },
  seasonTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  seasonTabText: { fontFamily: Colors.fonts.bold, fontSize: 12 },
  episodeCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    padding: 12, marginHorizontal: 16, marginBottom: 8, gap: 12,
  },
  episodeCardActive: { borderWidth: 1, borderColor: Colors.brand.primary },
  epNumber: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  epNumberText: { fontFamily: Colors.fonts.extraBold, fontSize: 14 },
  epInfo: { flex: 1 },
  epTitle: { fontFamily: Colors.fonts.bold, fontSize: 13, lineHeight: 18 },
  epMeta: { fontFamily: Colors.fonts.regular, fontSize: 11, marginTop: 2 },
  loadingWrap: { alignItems: 'center', paddingVertical: 30 },
  
  // Error styles
  errorStylePlaceholder: {
    fontFamily: Colors.fonts.regular,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 8,
  },
  errorText: {
    fontFamily: Colors.fonts.bold,
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  retryText: {
    fontFamily: Colors.fonts.medium,
    color: '#fff',
    fontSize: 12,
  },
  premiumGateSection: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0d1a',
    gap: 10,
  },
  premiumGateTitle: {
    fontFamily: Colors.fonts.extraBold,
    color: '#FFD700',
    fontSize: 18,
    textAlign: 'center',
  },
  premiumGateDesc: {
    fontFamily: Colors.fonts.regular,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  subscribeBtnDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  subscribeBtnText: {
    fontFamily: Colors.fonts.bold,
    color: '#fff',
    fontSize: 14,
  },
});
