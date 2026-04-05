import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Platform,
  BackHandler,
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import {
  ArrowBackIcon, PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon,
  ExpandIcon, ContractIcon, RotateIcon, PersonIcon, LogoutIcon,
  DiamondIcon, InfoIcon,
} from '@/components/AppIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import Colors from '@/constants/Colors';
import {
  requestLiveStream,
  releaseStream,
  isStreamReady,
  getToken,
  getCloudServerUrl,
  requestFreeStream,
  requestPremiumStream,
  requestIptvVodStream,
  requestIptvSeriesStream,
  fetchSubscription,
  getSavedUser,
  isLoggedIn,
  addWatchHistory,
} from '@/constants/Api';

// JavaScript to inject BEFORE page loads - NUCLEAR MAXIMUM ad blocking
const WEBVIEW_EARLY_JS = `
(function() {
  // ========== 0. إجبار عرض الموبايل ==========
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  (document.head || document.documentElement).appendChild(viewport);
  
  if (window.screen) {
    Object.defineProperty(window.screen, 'width', { value: 393, writable: false });
    Object.defineProperty(window.screen, 'height', { value: 851, writable: false });
    Object.defineProperty(window.screen, 'availWidth', { value: 393, writable: false });
    Object.defineProperty(window.screen, 'availHeight', { value: 851, writable: false });
  }
  
  Object.defineProperty(window, 'innerWidth', { value: 393, writable: false, configurable: false });
  Object.defineProperty(window, 'innerHeight', { value: 851, writable: false, configurable: false });
  Object.defineProperty(window, 'outerWidth', { value: 393, writable: false, configurable: false });
  Object.defineProperty(window, 'outerHeight', { value: 851, writable: false, configurable: false });
  
  const mobileStyle = document.createElement('style');
  mobileStyle.textContent = \`
    html, body {
      width: 100vw !important;
      max-width: 100vw !important;
      overflow-x: hidden !important;
      -webkit-text-size-adjust: 100% !important;
      touch-action: manipulation !important;
    }
    video, iframe[src*="vidsrc"], [class*="player"], [id*="player"] {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      object-fit: contain !important;
    }
    button, [role="button"], .button, [class*="btn"], [class*="control"] {
      min-width: 44px !important;
      min-height: 44px !important;
      touch-action: manipulation !important;
    }
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

  // Comprehensive list of ad domains to block
  const adDomains = [
    // مواقع البالغين
    'gloporn', 'hadesex', 'pornhub', 'xvideos', 'xhamster', 'redtube', 'youporn', 'tube8',
    'livejasmin', 'chaturbate', 'stripchat', 'bongacams', 'cam4', 'camsoda', 'myfreecams',
    'spankbang', 'xnxx', 'beeg', 'brazzers', 'naughtyamerica', 'realitykings',
    // Google Ads
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'adservice.google.com', 'pagead2.googlesyndication.com', 'google-analytics.com',
    'googletagmanager.com', 'googletagservices.com', 'adsense',
    // Major ad networks
    'adsrvr.org', 'adnxs.com', 'adsafeprotected.com', 'moatads.com',
    'amazon-adsystem.com', 'adsymptotic.com', 'adcolony.com', 'unity3d.com/ads',
    'criteo.com', 'criteo.net', 'pubmatic.com', 'openx.net', 'rubiconproject.com',
    'spotxchange.com', 'teads.tv', 'adform.net', 'smartadserver.com',
    // Popup/Popunder networks
    'popads.net', 'popcash.net', 'propellerads.com', 'popmyads.com',
    'popunderjs.com', 'popunder.net', 'richpush.co', 'pushengage.com',
    'pushground.com', 'webpushr.com', 'onesignal.com', 'pushwoosh.com',
    'zeroredirect.com', 'onclickmax.com', 'onclickalgo.com', 'onclickads.net',
    // Native ads
    'outbrain.com', 'taboola.com', 'mgid.com', 'revcontent.com', 'contentad.net', 'content.ad',
    // Adult ad networks
    'exoclick.com', 'juicyads.com', 'trafficjunky.com', 'trafficstars.com', 'plugrush.com',
    // Other ad networks
    'admaven.com', 'adsterra.com', 'adcash.com', 'bidvertiser.com',
    'hilltopads.com', 'clickadu.com', 'propellerclick.com', 'clickaine.com',
    'a-ads.com', 'adtng.com', 'adxpremium.com', 'ad-maven.com',
    'yllix.com', 'revenuehits.com', 'adversal.com', 'infolinks.com', 'media.net',
    // Shortened links
    'adf.ly', 'shorte.st', 'linkbucks.com', 'sh.st', 'bc.vc', 'adfoc.us', 'adfly.com',
    // Tracking
    'facebook.com/tr', 'connect.facebook.net', 'analytics.', 'tracker.',
    'tracking.', 'pixel.', 'beacon.', 'telemetry.', 'metrics.',
    'afftrack.com', 'go2cloud.org', 'appsflyer.com', 'adjust.com', 'voluum.com', 'clickmeter.com',
    // Suspicious domains
    'twistyfunnels.com', 'vialotadom.com', 'astronautlividlyreformer.com',
    'pothertion.com', 'viicmkru.com', 'performet.qpon', 'topsites',
    // Vidsrc specific ads
    'whos.amung.us', 'stream-verify.', 'verification.', 'captcha-delivery.',
    // Mining
    'coinhive', 'cryptoloot', 'coin-hive', 'minero', 'crypto-loot', 'webminer',
    // Generic patterns
    'ad.', 'ads.', 'adserver.', 'advertising.', 'banner.', 'sponsor.',
  ];
  
  const safeHosts = ['vidsrc.to', 'vidsrc.me', 'vidsrc.cc', 'vidsrc.net', 'vidplay', 'megacloud', 'mycloud', 'rabbitstream', 'dokicloud', 'tmdb.org', 'embed.su', 'superembed', 'autoembed', '2embed.cc', 'autoembed.cc', 'multiembed.mov', 'filemoon', 'streamwish'];

  // Helper function to check if URL is ad (conservative)
  // STRICT WHITELIST: السماح بنطاقات المصادر المتعددة
  const ALLOWED_HOSTS = ['vidsrc.to', 'vidsrc.cc', 'vidsrc.me', 'vidsrc.net', '2embed.cc', 'embed.su', 'autoembed.cc', 'multiembed.mov', 'vidplay', 'megacloud', 'rabbitstream', 'filemoon', 'streamwish'];
  
  const isAdUrl = (url) => {
    if (!url || typeof url !== 'string') return true; // حظر إذا فارغ
    const u = url.toLowerCase();
    
    // السماح بـ blob و data URLs
    if (u.startsWith('blob:') || u.startsWith('data:') || u.startsWith('about:')) return false;
    
    // السماح بملفات الميديا
    if (u.includes('.m3u8') || u.includes('.mp4') || u.includes('.ts') || u.includes('.webm')) return false;
    
    // السماح فقط بالنطاقات المحددة
    const isAllowed = ALLOWED_HOSTS.some(h => u.includes(h));
    
    // إذا لم يكن مسموح، فهو إعلان
    return !isAllowed;
  };

  // ========== 1. Block window.open (popups) ==========
  try {
    Object.defineProperty(window, 'open', { value: () => fakeWin, writable: false, configurable: false });
  } catch(e) { window.open = () => fakeWin; }
  
  // Block alert/confirm/prompt popups
  window.alert = noop;
  window.confirm = () => false;
  window.prompt = () => null;
  window.showModalDialog = noop;
  window.print = noop;

  // ========== 2. Block location changes (redirects) ==========
  try {
    const locDesc = Object.getOwnPropertyDescriptor(window, 'location');
    if (locDesc && locDesc.configurable !== false) {
      let currentHref = window.location.href;
      Object.defineProperty(window, 'location', {
        get: () => {
          const loc = new URL(currentHref);
          loc.assign = (url) => { if (!isAdUrl(url)) currentHref = url; };
          loc.replace = (url) => { if (!isAdUrl(url)) currentHref = url; };
          Object.defineProperty(loc, 'href', {
            get: () => currentHref,
            set: (v) => { if (!isAdUrl(v)) currentHref = v; }
          });
          return loc;
        },
        set: noop
      });
    }
  } catch(e) {}

  // ========== 3. CSS to hide ads only (conservative) ==========
  const style = document.createElement('style');
  style.textContent = \`
    .ad-showing, .ima-ad-container, .ytp-ad-module,
    .ytp-ad-overlay-container, .ytp-ad-text-overlay,
    [class*="taboola"], [class*="outbrain"], [class*="mgid"],
    [id*="taboola"], [id*="outbrain"], [id*="mgid"],
    iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
    iframe[src*="popads"], iframe[src*="adsterra"], iframe[src*="exoclick"],
    img[width="1"][height="1"], img[src*="pixel"], img[src*="beacon"]
    {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    a[href*="clickynx"], a[href*="popads"], a[href*="adsterra"],
    a[style*="position: absolute"][style*="opacity: 0"] {
      pointer-events: none !important;
      display: none !important;
    }
  \`;
  (document.head || document.documentElement).appendChild(style);

  // ========== 4. Block click events on suspicious elements ==========
  document.addEventListener('click', function(e) {
    const target = e.target;
    if (!target) return;
    
    // Check if click is on video player or controls
    if (target.closest('video') || target.closest('.jw-') || 
        target.closest('.vjs-') || target.closest('.plyr') ||
        target.closest('[class*="player"]') || target.closest('[class*="control"]')) {
      return; // Allow player clicks
    }
    
    // Block clicks on suspicious elements
    const href = target.href || target.closest('a')?.href;
    if (href && isAdUrl(href)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[AdBlock] Blocked click to:', href);
      return false;
    }
  }, true);

  // ========== 5. Override fetch to block ad requests ==========
  const origFetch = window.fetch;
  window.fetch = function(url, opts) {
    const urlStr = typeof url === 'string' ? url : (url.url || '');
    if (isAdUrl(urlStr)) {
      console.log('[AdBlock] Blocked fetch:', urlStr.substring(0, 60));
      return Promise.resolve(new Response('', { status: 204 }));
    }
    return origFetch.apply(this, arguments);
  };

  // Override XMLHttpRequest to block ad requests
  const origXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (isAdUrl(url)) {
      this._blocked = true;
      console.log('[AdBlock] Blocked XHR:', url.substring(0, 60));
      return;
    }
    return origXHROpen.apply(this, arguments);
  };
  
  const origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) return;
    return origXHRSend.apply(this, arguments);
  };
  
  // Block WebSocket and Workers
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
          return { postMessage: noop, terminate: noop, addEventListener: noop };
        }
        return new OrigWorker(url);
      };
    }
    
    navigator.sendBeacon = (url) => {
      if (isAdUrl(url)) return true;
      return true;
    };
  } catch(e) {}

  // ========== 6. Block createElement for script/iframe ads ==========
  const origCreate = document.createElement.bind(document);
  document.createElement = function(tag) {
    const el = origCreate(tag);
    const t = tag.toLowerCase();
    if (t === 'script' || t === 'iframe' || t === 'embed' || t === 'object') {
      const origSetAttr = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if (name === 'src' && isAdUrl(value)) {
          console.log('[AdBlock] Blocked src:', value.substring(0, 60));
          return;
        }
        return origSetAttr(name, value);
      };
      Object.defineProperty(el, 'src', {
        set: (v) => { if (!isAdUrl(v)) origSetAttr('src', v); },
        get: () => el.getAttribute('src'),
        configurable: true
      });
    }
    return el;
  };
  
  // Block appendChild for ad elements
  const origAppend = Node.prototype.appendChild;
  Node.prototype.appendChild = function(node) {
    if (node && node.tagName) {
      const tag = node.tagName.toLowerCase();
      if ((tag === 'script' || tag === 'iframe') && node.src && isAdUrl(node.src)) {
        console.log('[AdBlock] Blocked appendChild:', node.src.substring(0, 60));
        return node;
      }
    }
    return origAppend.call(this, node);
  };

  // ========== 7. Block event listeners ==========
  const suspiciousEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'contextmenu'];
  const isSuspiciousFn = (fn) => {
    if (!fn) return false;
    const s = fn.toString().toLowerCase();
    return s.includes('window.open') || s.includes('location.href') || s.includes('location.assign') ||
           s.includes('.click()') || s.includes('popup') || s.includes('redirect') || s.includes('popunder');
  };

  const origAddEvent = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, fn, opts) {
    if (suspiciousEvents.includes(type) && isSuspiciousFn(fn)) {
      console.log('[AdBlock] Blocked suspicious listener:', type);
      return;
    }
    return origAddEvent.call(this, type, fn, opts);
  };

  // ========== 7. CSS AGGRESSIVE: إخفاء كل الإعلانات ==========
  const style = document.createElement('style');
  style.textContent = \`
    /* إخفاء كل iframes ما عدا المشغل */
    iframe:not([src*="vidsrc"]):not([src*="vidplay"]):not([src*="megacloud"]):not([src*="rabbitstream"]):not([src*="embed"]):not([src*="2embed"]):not([src*="autoembed"]):not([src*="multiembed"]):not([src*="filemoon"]):not([src*="streamwish"]) {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      position: absolute !important;
      width: 0 !important;
      height: 0 !important;
    }
    
    /* إخفاء divs و overlays الإعلانية */
    div[id*="ad-"]:not([id*="video"]):not([id*="player"]), 
    div[class*="ad-"]:not([class*="video"]):not([class*="player"]), 
    div[id*="ads"]:not([id*="video"]), div[class*="ads"]:not([class*="video"]),
    div[id*="banner"], div[class*="banner"], 
    div[id*="popup"], div[class*="popup"],
    div[id*="modal"]:not([class*="player"]):not([class*="video"]), 
    div[class*="modal"]:not([class*="player"]):not([class*="video"]),
    [class*="taboola"], [class*="outbrain"], [class*="mgid"],
    [id*="taboola"], [id*="outbrain"], [id*="mgid"],
    .ad-showing, .ima-ad-container, .ytp-ad-module {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    
    /* إخفاء الروابط الشفافة فوق الفيديو */
    a[style*="position: absolute"],
    a[style*="position:absolute"],
    a[href*="jup9"], a[href*="clickynx"], a[href*="popads"], 
    a[href*="adsterra"], a[href*="exoclick"], a[href*="afu.php"] {
      display: none !important;
      pointer-events: none !important;
      opacity: 0 !important;
    }
    
    /* إخفاء عناصر التتبع */
    img[width="1"][height="1"], img[src*="pixel"], img[src*="beacon"],
    img[src*="track"], img[src*="analytics"] {
      display: none !important;
    }
    
    /* منع أي عنصر ثابت بـ z-index عالي (إعلانات منبثقة) */
    div[style*="position: fixed"][style*="z-index"],
    div[style*="position:fixed"][style*="z-index"] {
      display: none !important;
    }
    
    /* إخفاء أي overlay ليس جزء من المشغل */
    .overlay:not(.vjs-overlay):not([class*="player"]),
    [class*="overlay"]:not([class*="player"]):not([class*="video"]) {
      display: none !important;
    }
  \`;
  (document.head || document.documentElement).appendChild(style);

  // ========== 8. Conservative ad link removal ==========
  function removeAds() {
    // إزالة كل iframes ما عدا المشغل
    document.querySelectorAll('iframe').forEach(iframe => {
      const src = (iframe.src || '').toLowerCase();
      const allowedDomains = ['vidsrc', 'vidplay', 'megacloud', 'rabbitstream', 'embed', '2embed', 'autoembed', 'multiembed', 'filemoon', 'streamwish', 'dokicloud'];
      if (!allowedDomains.some(d => src.includes(d))) {
        iframe.remove();
      }
    });
    
    // Remove ad links
    document.querySelectorAll('a[href*="jup9"], a[href*="clickynx"], a[href*="popads"], a[href*="adsterra"], a[href*="exoclick"], a[href*="afu.php"]').forEach(a => {
      a.remove();
    });
    
    // إزالة divs إعلانية
    document.querySelectorAll('[id*="ad-"], [class*="ad-"], [id*="popup"], [class*="popup"]').forEach(el => {
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
    
    // إزالة عناصر ثابتة بـ z-index عالي (إعلانات منبثقة)
    document.querySelectorAll('div, a').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' && parseInt(style.zIndex) > 900) {
        if (!el.closest('video') && !el.querySelector('video') && 
            !el.closest('[class*="player"]')) {
          el.remove();
        }
      }
    });
  }
  
  // Run ad removal aggressively
  removeAds();
  setInterval(removeAds, 500);
  document.addEventListener('DOMContentLoaded', removeAds);

  // Handle fullscreen
  document.addEventListener('fullscreenchange', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'fullscreen',
      isFullscreen: !!document.fullscreenElement
    }));
  });

  // Listen for video events
  document.addEventListener('play', function(e) {
    if (e.target.tagName === 'VIDEO') {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_playing' }));
    }
  }, true);

  document.addEventListener('waiting', function(e) {
    if (e.target.tagName === 'VIDEO') {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_buffering', buffering: true }));
    }
  }, true);

  document.addEventListener('playing', function(e) {
    if (e.target.tagName === 'VIDEO') {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_buffering', buffering: false }));
    }
  }, true);

  document.addEventListener('canplay', function(e) {
    if (e.target.tagName === 'VIDEO') {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_buffering', buffering: false }));
    }
  }, true);

  document.addEventListener('error', function(e) {
    if (e.target.tagName === 'VIDEO') {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_error', error: 'Video playback error' }));
    }
  }, true);

  console.log('[AdBlock] NUCLEAR ad blocker loaded - ALL ADS BLOCKED');
  true;
})();
`;

// JavaScript to inject AFTER page loads - auto-play and clean up (YouTube-style)
const WEBVIEW_INJECT_JS = `
(function() {
  let videoStarted = false;
  let retryCount = 0;
  const MAX_RETRIES = 20;

  // Force autoplay on video elements
  function forceAutoplay() {
    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return false;
    
    let played = false;
    videos.forEach(v => {
      // Configure video for autoplay
      v.autoplay = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.preload = 'auto';
      
      // Remove any paused state
      if (v.paused) {
        // Try unmuted first
        v.muted = false;
        v.volume = 1;
        
        const playPromise = v.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            videoStarted = true;
            played = true;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_playing' }));
          }).catch(() => {
            // Fallback: try muted autoplay then unmute
            v.muted = true;
            v.play().then(() => {
              videoStarted = true;
              played = true;
              // Unmute after a short delay
              setTimeout(() => { v.muted = false; v.volume = 1; }, 500);
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'video_playing' }));
            }).catch(() => {});
          });
        }
      } else {
        videoStarted = true;
        played = true;
      }
    });
    return played;
  }

  // Click any play buttons on the page
  function clickPlayButtons() {
    const playSelectors = [
      '.vjs-big-play-button',
      '.jw-icon-playback',
      '[class*="play-button"]',
      '[class*="play-btn"]',
      '[aria-label*="play" i]',
      '[title*="play" i]',
      'button[class*="play"]',
      '.plyr__control--overlaid',
    ];
    
    playSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        try {
          if (btn.offsetParent !== null && btn.offsetWidth > 0) {
            btn.click();
          }
        } catch(e) {}
      });
    });
  }

  // Remove ad overlays and popups
  function removeAdOverlays() {
    const adSelectors = [
      '.overlay:not(.vjs-overlay):not([class*="player"])',
      '.modal:not([class*="player"])',
      '.popup', '.popunder',
      '[class*="ad-overlay"]',
      '[class*="ad-container"]',
      '[class*="preroll"]',
      '[id*="ad-"]',
    ];
    
    adSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.closest('video') && !el.querySelector('video') && 
            !el.closest('.vjs-') && !el.closest('.jw-') && !el.closest('.plyr')) {
          el.style.setProperty('display', 'none', 'important');
        }
      });
    });

    // Click close/skip buttons
    document.querySelectorAll('[class*="close"], [class*="skip"], [class*="dismiss"]').forEach(btn => {
      if (btn.offsetParent !== null) {
        try { btn.click(); } catch(e) {}
      }
    });
  }

  // Main autoplay function
  function tryAutoplay() {
    if (videoStarted || retryCount >= MAX_RETRIES) return;
    retryCount++;
    
    removeAdOverlays();
    clickPlayButtons();
    forceAutoplay();
    
    // Keep trying until video starts
    if (!videoStarted) {
      setTimeout(tryAutoplay, 500);
    }
  }

  // Start immediately
  tryAutoplay();
  
  // Also run on various events
  document.addEventListener('DOMContentLoaded', tryAutoplay);
  window.addEventListener('load', tryAutoplay);

  // Watch for dynamically added videos
  const observer = new MutationObserver(() => {
    if (!videoStarted) {
      const video = document.querySelector('video');
      if (video) {
        removeAdOverlays();
        forceAutoplay();
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Periodic check for stubborn players
  const interval = setInterval(() => {
    if (videoStarted) {
      clearInterval(interval);
      return;
    }
    tryAutoplay();
  }, 1000);

  // Stop after 30 seconds
  setTimeout(() => clearInterval(interval), 30000);

  true;
})();
`;

function srtTimeToSec(t: string): number {
  const clean = t.trim().replace(',', '.');
  const dotIdx = clean.lastIndexOf('.');
  const hms = dotIdx >= 0 ? clean.slice(0, dotIdx) : clean;
  const ms2 = dotIdx >= 0 ? clean.slice(dotIdx + 1) : '0';
  const parts = hms.split(':').map(Number);
  const h = parts.length === 3 ? parts[0] : 0;
  const m = parts.length === 3 ? parts[1] : (parts[0] ?? 0);
  const s = parts.length === 3 ? parts[2] : (parts[1] ?? 0);
  return h * 3600 + m * 60 + s + parseInt(ms2.padEnd(3, '0').slice(0, 3)) / 1000;
}

function parseSrtMobile(raw: string): { start: number; end: number; text: string }[] {
  const cues: { start: number; end: number; text: string }[] = [];
  const blocks = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) continue;
    const arrow = lines[ti].split('-->');
    if (arrow.length < 2) continue;
    const text = lines.slice(ti + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (text) cues.push({ start: srtTimeToSec(arrow[0]), end: srtTimeToSec(arrow[1]), text });
  }
  return cues;
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// قائمة المصادر المتعددة مع الاحتياطي
const EMBED_SOURCES = [
  { name: 'vidsrc.to', buildUrl: (id: string, type: string, s?: number, e?: number) => 
    type === 'tv' ? `https://vidsrc.to/embed/tv/${id}/${s || 1}/${e || 1}` : `https://vidsrc.to/embed/movie/${id}` },
  { name: 'vidsrc.cc', buildUrl: (id: string, type: string, s?: number, e?: number) => 
    type === 'tv' ? `https://vidsrc.cc/v2/embed/tv/${id}/${s || 1}/${e || 1}` : `https://vidsrc.cc/v2/embed/movie/${id}` },
  { name: 'vidsrc.me', buildUrl: (id: string, type: string, s?: number, e?: number) => 
    type === 'tv' ? `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s || 1}&episode=${e || 1}` : `https://vidsrc.me/embed/movie?tmdb=${id}` },
  { name: '2embed.cc', buildUrl: (id: string, type: string, s?: number, e?: number) => 
    type === 'tv' ? `https://www.2embed.cc/embedtv/${id}&s=${s || 1}&e=${e || 1}` : `https://www.2embed.cc/embed/${id}` },
  { name: 'embed.su', buildUrl: (id: string, type: string, s?: number, e?: number) => 
    type === 'tv' ? `https://embed.su/embed/tv/${id}/${s || 1}/${e || 1}` : `https://embed.su/embed/movie/${id}` },
  { name: 'autoembed.cc', buildUrl: (id: string, type: string, s?: number, e?: number) => 
    type === 'tv' ? `https://autoembed.cc/embed/tv/${id}/${s || 1}/${e || 1}` : `https://autoembed.cc/embed/movie/${id}` },
];

function buildEmbedUrl(tmdbId: string, type: 'movie' | 'tv', season?: number, episode?: number, sourceIndex = 0) {
  const source = EMBED_SOURCES[sourceIndex % EMBED_SOURCES.length];
  return source.buildUrl(tmdbId, type, season, episode);
}

function getSourceName(sourceIndex: number) {
  return EMBED_SOURCES[sourceIndex % EMBED_SOURCES.length].name;
}

export default function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    channelId?: string;
    freeChannelId?: string;
    premiumChannelId?: string;
    title?: string;
    tmdbId?: string;
    vidsrcType?: string;
    season?: string;
    episode?: string;
    xtreamVodId?: string;
    xtreamEpisodeId?: string;
    xtreamExt?: string;
  }>();

  const videoRef = useRef<Video>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cloudStreamIdRef = useRef<string>('');
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const isSeeking = useRef(false);

  const [error, setError] = useState('');
  const [requiresSubscription, setRequiresSubscription] = useState(false);
  const [isLoggedInPlayer, setIsLoggedInPlayer] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [loadingStream, setLoadingStream] = useState(true);
  const [streamUrl, setStreamUrl] = useState('');
  const [streamHeaders, setStreamHeaders] = useState<Record<string, string>>({});
  const [cloudStreamId, setCloudStreamId] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [showSpinner, setShowSpinner] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [bufferedPosition, setBufferedPosition] = useState(0);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN);
  const [embedUrl, setEmbedUrl] = useState('');
  const [isWebViewFullscreen, setIsWebViewFullscreen] = useState(false);
  const [webViewError, setWebViewError] = useState(false);
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right'; seconds: number } | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [currentSourceName, setCurrentSourceName] = useState('');
  const webviewRef = useRef<WebView>(null);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<any | null>(null);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const { width: screenWidth } = Dimensions.get('window');

  const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;
  const freeChannelId = Array.isArray(params.freeChannelId) ? params.freeChannelId[0] : params.freeChannelId;
  const premiumChannelId = Array.isArray(params.premiumChannelId) ? params.premiumChannelId[0] : params.premiumChannelId;
  const titleParam = Array.isArray(params.title) ? params.title[0] : params.title;
  const tmdbId = Array.isArray(params.tmdbId) ? params.tmdbId[0] : params.tmdbId;
  const vidsrcType = (Array.isArray(params.vidsrcType) ? params.vidsrcType[0] : params.vidsrcType) as 'movie' | 'tv' | undefined;
  const seasonNum = params.season ? parseInt(Array.isArray(params.season) ? params.season[0] : params.season, 10) : undefined;
  const episodeNum = params.episode ? parseInt(Array.isArray(params.episode) ? params.episode[0] : params.episode, 10) : undefined;
  const xtreamVodId = Array.isArray(params.xtreamVodId) ? params.xtreamVodId[0] : params.xtreamVodId;
  const xtreamEpisodeId = Array.isArray(params.xtreamEpisodeId) ? params.xtreamEpisodeId[0] : params.xtreamEpisodeId;
  const xtreamExt = (Array.isArray(params.xtreamExt) ? params.xtreamExt[0] : params.xtreamExt) || 'mp4';
  const isIptvVod = !!xtreamVodId || !!xtreamEpisodeId;
  const isLive = !!channelId || !!freeChannelId || !!premiumChannelId;
  const isFreeChannel = !!freeChannelId;
  const isPremiumChannel = !!premiumChannelId;
  const isVidsrc = !!tmdbId && !channelId && !freeChannelId && !premiumChannelId && !isIptvVod;

  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    const sub = ScreenOrientation.addOrientationChangeListener((event) => {
      const o = event.orientationInfo.orientation;
      setIsLandscape(
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
      );
    });

    ScreenOrientation.getOrientationAsync()
      .then((o) => {
        setIsLandscape(
          o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
        );
      })
      .catch(() => {});

    return () => {
      ScreenOrientation.removeOrientationChangeListener(sub);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setLoadingStream(true);
    setError('');
    setRequiresSubscription(false);
    setStreamUrl('');
    setEmbedUrl('');
    setStreamHeaders({});
    setIsPlaying(true);
    setShowSpinner(true);
    setShowControls(true);
    setDuration(0);
    setPosition(0);

    async function initStream() {
      try {
        // Premium channels (beIN Sports + الكأس) - requires subscription
        if (premiumChannelId) {
          console.log('[Player] Premium channel:', premiumChannelId);
          const result = await requestPremiumStream(premiumChannelId);
          if (cancelled) return;

          if (result?.success && result.streamUrl) {
            console.log('[Player] Premium stream URL:', result.streamUrl);
            const hdrs: Record<string, string> = {};
            if (result.headers) Object.assign(hdrs, result.headers);

            setCloudStreamId(premiumChannelId);
            cloudStreamIdRef.current = premiumChannelId;
            setStreamHeaders(hdrs);
            setStreamUrl(result.streamUrl);
            setLoadingStream(false);
            return;
          }

          if (result?.requiresSubscription) {
            setRequiresSubscription(true);
            setError(result.expired ? 'انتهى اشتراكك' : 'يتطلب اشتراك بريميوم');
          } else {
            setError(result?.error || 'البث غير متاح حالياً');
          }
          setLoadingStream(false);
          return;
        }

        // Free IPTV channels - direct stream URL from server
        if (freeChannelId) {
          console.log('[Player] Free channel:', freeChannelId);
          const result = await requestFreeStream(freeChannelId);
          if (cancelled) return;

          if (result?.success && result.streamUrl) {
            console.log('[Player] Free stream URL:', result.streamUrl);
            const hdrs: Record<string, string> = {};
            if (result.headers) Object.assign(hdrs, result.headers);

            // Add auth header only for live-pipe (server-proxied) — NOT for token redirects
            // Token redirect (/xtream-play/) goes to IPTV directly; sending JWT there breaks playback
            if (result.streamUrl.includes('/live-pipe/')) {
              const token = await getToken();
              if (token) hdrs.Authorization = `Bearer ${token}`;
            }

            setCloudStreamId(freeChannelId);
            cloudStreamIdRef.current = freeChannelId;
            setStreamHeaders(hdrs);
            setStreamUrl(result.streamUrl);
            setLoadingStream(false);
            return;
          }

          setError('تعذّر تحميل البث — تحقق من اتصالك');
          setLoadingStream(false);
          return;
        }

        // IPTV VOD — فيلم أو حلقة مسلسل من Xtream
        if (xtreamVodId || xtreamEpisodeId) {
          console.log('[Player] IPTV VOD:', xtreamVodId || xtreamEpisodeId);
          const result = xtreamEpisodeId
            ? await requestIptvSeriesStream(xtreamEpisodeId, xtreamExt)
            : await requestIptvVodStream(xtreamVodId!, xtreamExt);
          if (cancelled) return;

          if (result?.success && result.streamUrl) {
            console.log('[Player] IPTV VOD URL:', result.streamUrl);
            setStreamUrl(result.streamUrl);
            setLoadingStream(false);
            // Record watch history
            addWatchHistory({
              item_id: xtreamVodId || xtreamEpisodeId || '',
              item_type: 'vod',
              title: titleParam || '',
              content_type: xtreamEpisodeId ? 'series' : 'movie',
            }).catch(() => {});
            return;
          }

          setError(result?.error || 'تعذّر تحميل الفيلم');
          setLoadingStream(false);
          return;
        }

        // Live channels (IPTV from database) - use native player
        if (channelId) {
          const result = await requestLiveStream(channelId);
          if (cancelled) return;

          if (result?.success && (result.hlsUrl || result.vodUrl)) {
            const sid = result.streamId || channelId;
            const playUrl = result.vodUrl || result.hlsUrl || '';
            const hdrs: Record<string, string> = {};
            if (result.headers) Object.assign(hdrs, result.headers);

            // Only add auth for live-pipe (server-proxied); token redirects go directly to IPTV
            if (playUrl.includes('/live-pipe/')) {
              const token = await getToken();
              if (token) hdrs.Authorization = `Bearer ${token}`;
            }

            setCloudStreamId(sid || '');
            cloudStreamIdRef.current = sid || '';
            setStreamHeaders(hdrs);

            if (result.vodUrl || result.ready) {
              setStreamUrl(playUrl);
              setLoadingStream(false);
            } else {
              readyPollRef.current = setInterval(async () => {
                if (cancelled) return;
                const ready = await isStreamReady(sid || '');
                if (ready) {
                  if (readyPollRef.current) clearInterval(readyPollRef.current);
                  setStreamUrl(playUrl);
                  setLoadingStream(false);
                }
              }, 1500);
            }
            return;
          }

          if (result?.requiresSubscription) {
            setRequiresSubscription(true);
            setError(result.expired ? 'انتهى اشتراكك' : 'يتطلب اشتراك بريميوم');
          } else {
            setError(result?.error || 'فشل جلب البث المباشر');
          }
          setLoadingStream(false);
          return;
        }

        // VOD content - check subscription then use WebView embed
        if (isVidsrc && tmdbId) {
          const logged = await isLoggedIn();
          setIsLoggedInPlayer(logged);
          if (!logged) {
            setRequiresSubscription(true);
            setError('login_required');
            setLoadingStream(false);
            return;
          }
          const [sub, savedUser] = await Promise.all([fetchSubscription(), getSavedUser()]);
          if (cancelled) return;
          const role = savedUser?.role || 'user';
          const canWatch = sub?.isPremium || role === 'admin' || role === 'agent';
          if (!canWatch) {
            setRequiresSubscription(true);
            setError('يتطلب اشتراك بريميوم');
            setLoadingStream(false);
            return;
          }
          const s = seasonNum || 1;
          const e = episodeNum || 1;
          const embed = buildEmbedUrl(tmdbId, vidsrcType || 'movie', s, e, sourceIndex);
          setEmbedUrl(embed);
          setCurrentSourceName(getSourceName(sourceIndex));
          setLoadingStream(false);
          console.log(`[Player] Using source ${sourceIndex}: ${getSourceName(sourceIndex)}`);
        }
      } catch {
        if (cancelled) return;
        setError('خطأ في الاتصال بالسيرفر');
        setLoadingStream(false);
      }
    }

    initStream();

    return () => {
      cancelled = true;
      if (readyPollRef.current) clearInterval(readyPollRef.current);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      if (cloudStreamIdRef.current) releaseStream(cloudStreamIdRef.current).catch(() => {});
    };
  }, [channelId, freeChannelId, premiumChannelId, tmdbId, vidsrcType, seasonNum, episodeNum, xtreamVodId, xtreamEpisodeId, xtreamExt, retryKey, sourceIndex]);

  // دالة للتبديل إلى المصدر الاحتياطي التالي
  const fetchSubtitlesMobile = useCallback(async () => {
    if (!tmdbId) return;
    try {
      const cloudUrl = await getCloudServerUrl();
      let url = `${cloudUrl}/api/subtitles?tmdbId=${tmdbId}&type=${vidsrcType || 'movie'}`;
      if (vidsrcType === 'tv' && seasonNum && episodeNum) {
        url += `&season=${seasonNum}&episode=${episodeNum}`;
      }
      const token = await getToken();
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      if (data.subtitles?.length) setSubtitles(data.subtitles);
    } catch {}
  }, [tmdbId, vidsrcType, seasonNum, episodeNum]);

  const selectSubtitleMobile = useCallback(async (sub: any | null) => {
    setShowSubMenu(false);
    if (!sub) {
      setActiveSubtitle(null);
      webviewRef.current?.injectJavaScript(`window.__subCues=[];if(window.__subOverlay)window.__subOverlay.style.display='none';true;`);
      return;
    }
    setActiveSubtitle(sub);
    setSubLoading(true);
    try {
      const cloudUrl = await getCloudServerUrl();
      const proxyUrl = `${cloudUrl}/api/subtitle-proxy?url=${encodeURIComponent(sub.url)}`;
      const r = await fetch(proxyUrl);
      const text = await r.text();
      const cues = parseSrtMobile(text);
      const cuesJson = JSON.stringify(cues);
      webviewRef.current?.injectJavaScript(`
(function(){
  window.__subCues=${cuesJson};
  if(!window.__subOverlay){
    var div=document.createElement('div');
    div.style.cssText='position:fixed;bottom:15%;left:0;right:0;text-align:center;z-index:2147483647;pointer-events:none;padding:0 12px;';
    document.body.appendChild(div);
    window.__subOverlay=div;
    document.addEventListener('timeupdate',function(e){
      if(e.target.tagName!=='VIDEO'||!window.__subCues)return;
      var t=e.target.currentTime;
      var cue=window.__subCues.find(function(c){return t>=c.start&&t<=c.end;});
      if(window.__subOverlay){
        if(cue){
          window.__subOverlay.innerHTML='<div style="display:inline-block;background:rgba(0,0,0,0.85);color:#fff;padding:8px 16px;border-radius:8px;font-size:16px;line-height:1.6;max-width:90vw;direction:rtl;text-align:center;">'+cue.text.replace(/\\n/g,'<br>')+'</div>';
          window.__subOverlay.style.display='block';
        }else{
          window.__subOverlay.style.display='none';
        }
      }
    },true);
  }
  window.__subOverlay.style.display='none';
})();
true;
      `);
    } catch {}
    finally { setSubLoading(false); }
  }, []);

  useEffect(() => {
    if (isVidsrc && embedUrl) {
      setSubtitles([]);
      setActiveSubtitle(null);
      fetchSubtitlesMobile();
    }
  }, [isVidsrc, embedUrl, fetchSubtitlesMobile]);

  const tryNextSource = useCallback(() => {
    if (sourceIndex < EMBED_SOURCES.length - 1) {
      console.log(`[Player] Trying next source: ${sourceIndex + 1}`);
      setSourceIndex(prev => prev + 1);
      setWebViewError(false);
      setError('');
      setLoadingStream(true);
    } else {
      setError('جميع المصادر غير متاحة - جرب لاحقاً');
    }
  }, [sourceIndex]);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), 5000);
  }, []);

  useEffect(() => {
    if (!isLive) return;
    resetControlsTimer();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [isLive, resetControlsTimer]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.log('Playback error:', status.error);
        // رسالة أوضح حسب نوع الخطأ
        if (status.error.includes('403') || status.error.includes('Forbidden')) {
          setError('البث محظور - جرب قناة أخرى');
        } else if (status.error.includes('404') || status.error.includes('Not Found')) {
          setError('البث غير متاح - جرب قناة أخرى');
        } else if (status.error.includes('timeout') || status.error.includes('network')) {
          setError('مشكلة في الاتصال - تحقق من الإنترنت');
        } else {
          setError('فشل تشغيل البث - جرب قناة أخرى');
        }
      }
      return;
    }
    
    const buffering = status.isBuffering && !status.isPlaying;
    setIsBuffering(buffering);
    setShowSpinner(buffering && !isSeeking.current);
    setIsPlaying(status.isPlaying);
    
    if (!isSeeking.current) {
      setPosition(status.positionMillis);
    }
    
    if (status.durationMillis && status.durationMillis > 0) {
      setDuration(status.durationMillis);
    }
    
    if (status.playableDurationMillis) {
      setBufferedPosition(status.playableDurationMillis);
    }
  }, []);

  const toggleOrientation = async () => {
    if (isLandscape) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT).catch(() => {});
    }
  };

  const handleBack = async () => {
    if (cloudStreamIdRef.current) releaseStream(cloudStreamIdRef.current).catch(() => {});
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    router.back();
  };

  const handleRetry = () => {
    setRetryKey((value) => value + 1);
  };

  // Handle messages from WebView (fullscreen, video events)
  const onWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'fullscreen') {
        setIsWebViewFullscreen(data.isFullscreen);
        if (data.isFullscreen) {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT).catch(() => {});
        }
      } else if (data.type === 'video_playing') {
        setLoadingStream(false);
        setShowSpinner(false);
        setWebViewError(false);
      } else if (data.type === 'video_error') {
        console.log('WebView video error:', data.error);
        setWebViewError(true);
      } else if (data.type === 'video_buffering') {
        setIsBuffering(data.buffering);
      }
    } catch {}
  }, []);

  // Handle back button for WebView fullscreen
  useEffect(() => {
    if (!isVidsrc) return;
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isWebViewFullscreen && webviewRef.current) {
        webviewRef.current.injectJavaScript('document.exitFullscreen && document.exitFullscreen(); true;');
        setIsWebViewFullscreen(false);
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isVidsrc, isWebViewFullscreen]);

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    resetControlsTimer();
  };

  const seekBy = async (sec: number, showIndicator = true) => {
    if (!videoRef.current || duration <= 0) return;
    isSeeking.current = true;
    const next = Math.max(0, Math.min(position + sec * 1000, duration));
    setPosition(next);
    
    if (showIndicator) {
      setSeekIndicator({ side: sec > 0 ? 'right' : 'left', seconds: Math.abs(sec) });
      setTimeout(() => setSeekIndicator(null), 600);
    }
    
    try {
      await videoRef.current.setPositionAsync(next);
    } catch (e) {
      console.log('Seek error:', e);
    } finally {
      isSeeking.current = false;
    }
    resetControlsTimer();
  };

  const handleDoubleTap = (event: GestureResponderEvent) => {
    const now = Date.now();
    const tapX = event.nativeEvent.locationX;
    const { time, x } = lastTapRef.current;
    
    if (now - time < 300 && Math.abs(tapX - x) < 50) {
      const isLeftSide = tapX < screenWidth / 2;
      seekBy(isLeftSide ? -10 : 10);
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: tapX };
      if (showControls) {
        setShowControls(false);
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
      } else {
        resetControlsTimer();
      }
    }
  };

  const handleProgressBarSeek = async (event: GestureResponderEvent) => {
    if (!videoRef.current || duration <= 0) return;
    const { locationX } = event.nativeEvent;
    const progressBarWidth = screenWidth - 32;
    const percentage = Math.max(0, Math.min(locationX / progressBarWidth, 1));
    const seekPosition = percentage * duration;
    
    isSeeking.current = true;
    setPosition(seekPosition);
    
    try {
      await videoRef.current.setPositionAsync(seekPosition);
    } catch (e) {
      console.log('Progress seek error:', e);
    } finally {
      isSeeking.current = false;
    }
    resetControlsTimer();
  };

  // VOD content - WebView only (simple, no extraction)
  if (isVidsrc) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />
        {embedUrl ? (
          <WebView
            ref={webviewRef}
            key={`embed-${retryKey}-${embedUrl}`}
            source={{ uri: embedUrl }}
            style={styles.webview}
            onLoadStart={() => setLoadingStream(true)}
            onLoadEnd={() => setLoadingStream(false)}
            onError={() => {
              console.log(`[Player] Error loading source ${sourceIndex}: ${getSourceName(sourceIndex)}`);
              if (sourceIndex < EMBED_SOURCES.length - 1) {
                tryNextSource();
              } else {
                setError('فشل تحميل المشغل - جرب مصدر آخر');
              }
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.log(`[Player] HTTP Error ${nativeEvent.statusCode} on source ${sourceIndex}`);
              if (nativeEvent.statusCode >= 400 && sourceIndex < EMBED_SOURCES.length - 1) {
                tryNextSource();
              } else if (nativeEvent.statusCode >= 400) {
                setError('المصدر غير متاح - جرب مصدر آخر');
              }
            }}
            onMessage={onWebViewMessage}
            injectedJavaScriptBeforeContentLoaded={WEBVIEW_EARLY_JS}
            injectedJavaScript={WEBVIEW_INJECT_JS}
            injectedJavaScriptForMainFrameOnly={false}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures={false}
            onShouldStartLoadWithRequest={(request) => {
              const url = request.url.toLowerCase();
              
              // السماح بنطاقات المصادر المتعددة
              const allowedDomains = [
                'vidsrc.to',
                'vidsrc.cc',
                'vidsrc.me',
                'vidsrc.net',
                'vidsrc.xyz',
                '2embed.cc',
                'embed.su',
                'autoembed.cc',
                'multiembed.mov',
                'vidplay',
                'megacloud',
                'rabbitstream',
                'dokicloud',
                'filemoon',
                'streamwish',
              ];
              
              // السماح بـ blob و data URLs (للفيديو)
              if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('about:blank')) {
                return true;
              }
              
              // السماح بملفات الميديا فقط
              if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('.ts') || url.includes('.webm')) {
                return true;
              }
              
              // فحص إذا كان النطاق مسموح
              const isAllowed = allowedDomains.some(domain => url.includes(domain));
              
              if (!isAllowed) {
                console.log('[STRICT BLOCK] Navigation to:', url.substring(0, 100));
                return false;
              }
              
              return true;
            }}
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
            userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
          />
        ) : null}

        <View style={styles.embedTopBarWrapper} pointerEvents="box-none">
          <View style={styles.embedTopBar}>
            <TouchableOpacity style={styles.ctrlCircle} onPress={handleBack}>
              <ArrowBackIcon size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.embedTitle} numberOfLines={1}>
              {titleParam || 'مشغل'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {subtitles.length > 0 && (
                <TouchableOpacity
                  style={[styles.ctrlCircle, activeSubtitle ? { backgroundColor: 'rgba(255,165,0,0.25)', borderWidth: 1, borderColor: Colors.brand.primary } : {}]}
                  onPress={() => setShowSubMenu(v => !v)}
                >
                  {subLoading ? (
                    <ActivityIndicator size="small" color={Colors.brand.primary} />
                  ) : (
                    <Text style={{ color: activeSubtitle ? Colors.brand.primary : '#fff', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 }}>CC</Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.ctrlCircle} onPress={toggleOrientation}>
                <RotateIcon size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          {showSubMenu && subtitles.length > 0 && (
            <View style={styles.subMenuPanel}>
              <TouchableOpacity style={styles.subMenuRow} onPress={() => selectSubtitleMobile(null)}>
                <Text style={[styles.subMenuText, !activeSubtitle && { color: Colors.brand.primary }]}>إيقاف الترجمة</Text>
              </TouchableOpacity>
              {subtitles.map((sub: any, i: number) => (
                <TouchableOpacity key={i} style={styles.subMenuRow} onPress={() => selectSubtitleMobile(sub)}>
                  <Text style={[styles.subMenuText, activeSubtitle?.url === sub.url && { color: Colors.brand.primary }]}>{sub.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {loadingStream && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator size="large" color={Colors.brand.primary} />
            <Text style={styles.bufferText}>جاري تحميل المشغل...</Text>
          </View>
        )}

        {requiresSubscription ? (
          <View style={styles.centerOverlay}>
            {error === 'login_required' ? (
              <>
                <PersonIcon size={52} color="rgba(255,255,255,0.7)" />
                <Text style={styles.premiumGateTitle}>يجب تسجيل الدخول</Text>
                <Text style={styles.premiumGateDesc}>سجّل دخولك واشترك ببريميوم لمشاهدة هذا المحتوى</Text>
                <TouchableOpacity style={styles.subscribeBtn} onPress={() => { router.back(); router.push('/(tabs)/account' as any); }}>
                  <LogoutIcon size={16} color="#fff" />
                  <Text style={styles.subscribeBtnText}>تسجيل الدخول</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <DiamondIcon size={52} color="#FFD700" />
                <Text style={styles.premiumGateTitle}>اشتراك بريميوم مطلوب</Text>
                <Text style={styles.premiumGateDesc}>
                  {error === 'انتهى اشتراكك'
                    ? 'انتهت صلاحية اشتراكك، يرجى التجديد'
                    : 'هذا المحتوى حصري للمشتركين بريميوم'}
                </Text>
                <TouchableOpacity style={styles.subscribeBtn} onPress={() => { router.back(); router.push('/subscription' as any); }}>
                  <DiamondIcon size={16} color="#fff" />
                  <Text style={styles.subscribeBtnText}>اشترك الآن</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.backFromPremium} onPress={() => router.back()}>
              <Text style={styles.backFromPremiumText}>رجوع</Text>
            </TouchableOpacity>
          </View>
        ) : (error || webViewError) ? (
          <View style={styles.centerOverlay}>
            <InfoIcon size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error || 'فشل تحميل الفيديو'}</Text>
            <Text style={styles.sourceText}>المصدر: {currentSourceName || getSourceName(sourceIndex)}</Text>
            <View style={styles.errorBtns}>
              <TouchableOpacity style={styles.retryBtn} onPress={() => {
                setWebViewError(false);
                setError('');
                handleRetry();
              }}>
                <Text style={styles.retryText}>إعادة المحاولة</Text>
              </TouchableOpacity>
              {sourceIndex < EMBED_SOURCES.length - 1 && (
                <TouchableOpacity style={[styles.retryBtn, { backgroundColor: Colors.brand.primary }]} onPress={tryNextSource}>
                  <Text style={styles.retryText}>جرب مصدر آخر</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  // Live streams - Native expo-av player
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <TouchableOpacity
        style={styles.videoWrap}
        activeOpacity={1}
        onPress={handleDoubleTap}
      >
        {streamUrl ? (
          <Video
            ref={videoRef}
            key={`${retryKey}-${streamUrl}`}
            source={{
              uri: streamUrl,
              headers: Object.keys(streamHeaders).length > 0 ? streamHeaders : undefined,
              overrideFileExtensionAndroid: isLive ? 'm3u8' : (isIptvVod ? xtreamExt : undefined),
            }}
            style={styles.video}
            resizeMode={resizeMode}
            shouldPlay
            isLooping={isLive}
            volume={1}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            onReadyForDisplay={() => setShowSpinner(false)}
          />
        ) : null}

        {requiresSubscription ? (
          <View style={styles.centerOverlay}>
            {error === 'login_required' ? (
              <>
                <PersonIcon size={52} color="rgba(255,255,255,0.7)" />
                <Text style={styles.premiumGateTitle}>يجب تسجيل الدخول</Text>
                <Text style={styles.premiumGateDesc}>سجّل دخولك واشترك ببريميوم لمشاهدة هذا المحتوى</Text>
                <TouchableOpacity style={styles.subscribeBtn} onPress={() => { router.back(); router.push('/(tabs)/account' as any); }}>
                  <LogoutIcon size={16} color="#fff" />
                  <Text style={styles.subscribeBtnText}>تسجيل الدخول</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <DiamondIcon size={52} color="#FFD700" />
                <Text style={styles.premiumGateTitle}>اشتراك بريميوم مطلوب</Text>
                <Text style={styles.premiumGateDesc}>
                  {error === 'انتهى اشتراكك'
                    ? 'انتهت صلاحية اشتراكك، يرجى التجديد'
                    : 'هذا المحتوى حصري للمشتركين بريميوم'}
                </Text>
                <TouchableOpacity style={styles.subscribeBtn} onPress={() => { router.back(); router.push('/subscription' as any); }}>
                  <DiamondIcon size={16} color="#fff" />
                  <Text style={styles.subscribeBtnText}>اشترك الآن</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.backFromPremium} onPress={() => router.back()}>
              <Text style={styles.backFromPremiumText}>رجوع</Text>
            </TouchableOpacity>
          </View>
        ) : error ? (
          <View style={styles.centerOverlay}>
            <InfoIcon size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {(loadingStream || showSpinner || isBuffering) && streamUrl && !error ? (
          <View style={styles.bufferingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={Colors.brand.primary} />
            <Text style={styles.bufferText}>
              {loadingStream ? 'جاري تشغيل البث...' : isBuffering ? 'جاري التحميل...' : ''}
            </Text>
          </View>
        ) : null}

        {seekIndicator && (
          <View style={[styles.seekIndicator, seekIndicator.side === 'left' ? styles.seekLeft : styles.seekRight]}>
            {seekIndicator.side === 'left' ? <SkipBackIcon size={32} color="#fff" /> : <SkipForwardIcon size={32} color="#fff" />}
            <Text style={styles.seekText}>{seekIndicator.seconds} ثانية</Text>
          </View>
        )}

        {showControls && !error && (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.ctrlCircle} onPress={handleBack}>
                <ArrowBackIcon size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.topTitle} numberOfLines={1}>
                {titleParam || (isLive ? 'مباشر' : 'مشغل')}
              </Text>
              <View style={styles.topActions}>
                <TouchableOpacity style={styles.ctrlCircle} onPress={toggleOrientation}>
                  <RotateIcon
                    size={18}
                    color="#fff"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ctrlCircle}
                  onPress={() => setResizeMode((prev) => 
                    prev === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN
                  )}
                >
                  {resizeMode === ResizeMode.CONTAIN ? <ExpandIcon size={18} color="#fff" /> : <ContractIcon size={18} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.centerControls}>
              {!isLive && (
                <TouchableOpacity style={styles.skipBtn} onPress={() => seekBy(-10)}>
                  <SkipBackIcon size={28} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.playPauseBtn} onPress={togglePlayPause}>
                {isPlaying ? <PauseIcon size={38} color="#fff" /> : <PlayIcon size={38} color="#fff" />}
              </TouchableOpacity>
              {!isLive && (
                <TouchableOpacity style={styles.skipBtn} onPress={() => seekBy(10)}>
                  <SkipForwardIcon size={28} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.bottomBar}>
              {isLive ? (
                <View style={styles.liveBadgeRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveLabel}>بث مباشر</Text>
                </View>
              ) : (
                <>
                  <View style={styles.timeRow}>
                    <Text style={styles.timeText}>{formatTime(position)}</Text>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.progressBarContainer}
                    activeOpacity={1}
                    onPress={handleProgressBarSeek}
                  >
                    <View style={[styles.progressBar, { direction: 'ltr' }]}>
                      {bufferedPosition > 0 && duration > 0 && (
                        <View
                          style={[
                            styles.bufferedFill,
                            { width: `${Math.min((bufferedPosition / duration) * 100, 100)}%` },
                          ]}
                        />
                      )}
                      <View
                        style={[
                          styles.progressFill,
                          { width: duration > 0 ? `${Math.min((position / duration) * 100, 100)}%` : '0%' },
                        ]}
                      />
                      {duration > 0 && (
                        <View
                          style={[
                            styles.progressThumb,
                            { left: `${Math.min((position / duration) * 100, 100)}%` },
                          ]}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoWrap: { flex: 1, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  webview: { flex: 1, backgroundColor: '#000' },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bufferText: {
    marginTop: 10,
    fontFamily: Colors.fonts.medium,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  errorText: {
    marginTop: 10,
    paddingHorizontal: 24,
    textAlign: 'center',
    fontFamily: Colors.fonts.medium,
    color: '#EF4444',
    fontSize: 14,
  },
  retryBtn: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: Colors.fonts.bold,
    color: '#fff',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.28)',
    direction: 'ltr',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingHorizontal: 14,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  ctrlCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    marginHorizontal: 8,
    textAlign: 'center',
    fontFamily: Colors.fonts.bold,
    color: '#fff',
    fontSize: 14,
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  skipBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    direction: 'ltr',
  },
  timeText: {
    fontFamily: Colors.fonts.medium,
    color: '#fff',
    fontSize: 12,
  },
  progressBarContainer: {
    paddingVertical: 10,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveLabel: {
    fontFamily: Colors.fonts.bold,
    color: '#EF4444',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  progressBar: {
    height: 5,
    borderRadius: 3,
    overflow: 'visible',
    backgroundColor: 'rgba(255,255,255,0.22)',
    position: 'relative',
  },
  bufferedFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    height: '100%',
    backgroundColor: Colors.brand.primary,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.brand.primary,
    transform: [{ translateX: -6 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  seekIndicator: {
    position: 'absolute',
    top: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 50,
    padding: 16,
    minWidth: 80,
    direction: 'ltr',
  },
  seekLeft: {
    left: '15%',
  },
  seekRight: {
    right: '15%',
  },
  seekText: {
    color: '#fff',
    fontFamily: Colors.fonts.medium,
    fontSize: 12,
    marginTop: 4,
  },
  embedTopBarWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  embedTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  embedTitle: {
    flex: 1,
    marginHorizontal: 8,
    textAlign: 'center',
    fontFamily: Colors.fonts.bold,
    color: '#fff',
    fontSize: 14,
  },
  subMenuPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 62,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 150,
    zIndex: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  subMenuRow: {
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  subMenuText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: Colors.fonts.medium,
    textAlign: 'right',
  },
  sourceText: {
    fontFamily: Colors.fonts.regular,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 8,
  },
  errorBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  premiumGateTitle: {
    marginTop: 14,
    fontFamily: Colors.fonts.extraBold,
    color: '#FFD700',
    fontSize: 20,
    textAlign: 'center',
  },
  premiumGateDesc: {
    marginTop: 8,
    paddingHorizontal: 32,
    fontFamily: Colors.fonts.regular,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    backgroundColor: Colors.brand.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
  },
  subscribeBtnText: {
    fontFamily: Colors.fonts.bold,
    color: '#fff',
    fontSize: 15,
  },
  backFromPremium: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backFromPremiumText: {
    fontFamily: Colors.fonts.medium,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
});
