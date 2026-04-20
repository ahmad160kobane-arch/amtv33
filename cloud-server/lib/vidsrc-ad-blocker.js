/**
 * VidSrc Ad Blocker — حظر الإعلانات والنوافذ المنبثقة في VidSrc Embeds
 * 
 * يحظر:
 * - window.open (النوافذ المنبثقة)
 * - الروابط التوجيهية (redirects)
 * - الإعلانات المضمنة
 * - النقرات الخادعة (clickjacking)
 * 
 * مستوحى من:
 * - AdguardTeam/PopupBlocker
 * - igorskyflyer/userscript-block-popups
 * - VidSrc-Embeds-NoAds
 */

/**
 * إنشاء سكريبت حظر الإعلانات لحقنه في iframe
 */
function generateAdBlockerScript() {
  return `
<script>
(function() {
  'use strict';
  
  console.log('[VidSrc Ad Blocker] Initializing...');
  
  // ═══════════════════════════════════════════════════════
  // 1. حظر window.open (النوافذ المنبثقة)
  // ═══════════════════════════════════════════════════════
  const originalOpen = window.open;
  const fakeWindow = {
    focus: function() {},
    blur: function() {},
    close: function() {},
    closed: true,
    document: { write: function() {} },
    location: { href: '' }
  };
  
  window.open = function(url, target, features) {
    console.log('[VidSrc Ad Blocker] ✗ Blocked window.open:', url);
    return fakeWindow;
  };
  
  // ═══════════════════════════════════════════════════════
  // 2. حظر الروابط التوجيهية
  // ═══════════════════════════════════════════════════════
  const originalReplace = window.location.replace;
  window.location.replace = function(url) {
    // السماح فقط بالروابط من نفس النطاق
    if (url && url.startsWith(window.location.origin)) {
      return originalReplace.call(window.location, url);
    }
    console.log('[VidSrc Ad Blocker] ✗ Blocked redirect:', url);
  };
  
  // حظر تغيير location.href للإعلانات
  let allowLocationChange = true;
  Object.defineProperty(window.location, 'href', {
    get: function() {
      return window.location.toString();
    },
    set: function(url) {
      if (allowLocationChange && url && url.startsWith(window.location.origin)) {
        window.location.assign(url);
      } else {
        console.log('[VidSrc Ad Blocker] ✗ Blocked location.href change:', url);
      }
    }
  });
  
  // ═══════════════════════════════════════════════════════
  // 3. حظر النقرات على روابط الإعلانات
  // ═══════════════════════════════════════════════════════
  function isAdLink(element) {
    if (!element) return false;
    
    // التحقق من الروابط المشبوهة
    const href = element.getAttribute('href') || '';
    const target = element.getAttribute('target') || '';
    
    // حظر الروابط التي تفتح في تبويب جديد
    if (target === '_blank') return true;
    
    // حظر الروابط المشبوهة
    const suspiciousPatterns = [
      /\\/\\/(ad|ads|click|track|pop|banner|promo|offer)/i,
      /javascript:/i,
      /data:/i,
      /about:blank/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(href));
  }
  
  function blockAdClick(event) {
    let element = event.target;
    
    // البحث عن أقرب رابط
    while (element && element !== document.body) {
      if (element.tagName === 'A' && isAdLink(element)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        console.log('[VidSrc Ad Blocker] ✗ Blocked ad link click:', element.href);
        return false;
      }
      element = element.parentElement;
    }
  }
  
  // حظر جميع أنواع النقرات
  const clickEvents = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];
  clickEvents.forEach(eventType => {
    document.addEventListener(eventType, blockAdClick, true);
  });
  
  // ═══════════════════════════════════════════════════════
  // 4. حظر الإعلانات المضمنة (DOM-based)
  // ═══════════════════════════════════════════════════════
  function removeAdElements() {
    // قائمة بالعناصر المشبوهة
    const adSelectors = [
      '[class*="ad-"]',
      '[class*="ads-"]',
      '[id*="ad-"]',
      '[id*="ads-"]',
      '[class*="banner"]',
      '[class*="popup"]',
      '[class*="overlay"]',
      'iframe[src*="doubleclick"]',
      'iframe[src*="googlesyndication"]',
      'iframe[src*="adserver"]',
      'iframe[src*="advertising"]',
      '[data-ad]',
      '[data-ads]'
    ];
    
    adSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          // التحقق من أن العنصر ليس مشغل الفيديو
          if (!el.closest('video') && !el.closest('[class*="player"]')) {
            el.remove();
            console.log('[VidSrc Ad Blocker] ✗ Removed ad element:', selector);
          }
        });
      } catch (e) {}
    });
  }
  
  // تشغيل عند تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeAdElements);
  } else {
    removeAdElements();
  }
  
  // مراقبة التغييرات في DOM (للإعلانات الديناميكية)
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length > 0) {
        removeAdElements();
      }
    });
  });
  
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
  
  // ═══════════════════════════════════════════════════════
  // 5. منع سرقة التركيز (popunder prevention)
  // ═══════════════════════════════════════════════════════
  window.addEventListener('blur', function() {
    setTimeout(function() {
      window.focus();
    }, 50);
  });
  
  // ═══════════════════════════════════════════════════════
  // 6. حظر beforeunload (منع الإعلانات عند المغادرة)
  // ═══════════════════════════════════════════════════════
  window.addEventListener('beforeunload', function(e) {
    // السماح فقط إذا كان المستخدم يغادر فعلاً
    if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
      e.preventDefault();
      e.returnValue = '';
    }
  }, true);
  
  console.log('[VidSrc Ad Blocker] ✓ Initialized successfully');
})();
</script>
`;
}

/**
 * معالجة HTML لإضافة Ad Blocker
 */
function injectAdBlocker(html) {
  // إضافة السكريبت في بداية <head> أو <body>
  const adBlockerScript = generateAdBlockerScript();
  
  // محاولة الحقن في <head>
  if (html.includes('<head>')) {
    return html.replace('<head>', '<head>' + adBlockerScript);
  }
  
  // محاولة الحقن في <body>
  if (html.includes('<body>')) {
    return html.replace('<body>', '<body>' + adBlockerScript);
  }
  
  // إذا لم يوجد head أو body، أضف في البداية
  return adBlockerScript + html;
}

/**
 * إنشاء HTML نظيف لـ VidSrc embed مع Ad Blocker
 */
function createCleanEmbed(embedUrl, title = 'VidSrc Player') {
  const adBlockerScript = generateAdBlockerScript();
  
  return `
<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
  ${adBlockerScript}
</head>
<body>
  <iframe 
    src="${embedUrl}" 
    allowfullscreen 
    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
    sandbox="allow-same-origin allow-scripts allow-forms"
    referrerpolicy="no-referrer-when-downgrade"
  ></iframe>
</body>
</html>
`;
}

module.exports = {
  generateAdBlockerScript,
  injectAdBlocker,
  createCleanEmbed,
};
