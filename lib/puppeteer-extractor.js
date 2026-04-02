/**
 * Puppeteer Extractor — استخراج روابط m3u8/mp4 + ترجمات من vidsrc.cc
 * 
 * يستخدم متصفح headless حقيقي مع stealth لتجاوز Cloudflare
 * ينقر على play ثم يعترض طلبات الشبكة لالتقاط رابط m3u8 الحقيقي
 * (مثل stormfox27.live/...m3u8)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const HLS_RE = /\.m3u8/i;
const MP4_RE = /\.mp4(\?|$)/i;
const SUB_RE = /\.(vtt|srt|ass|ssa)/i;
const AD_RE = /doubleclick|googlesyndication|adservice|popads|pop\.|taboola|outbrain|mgid|adexchange|usrpubtrk|adnxs/i;

let browser = null;
let launching = null;

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;
  if (launching) return launching;
  launching = puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-gpu', '--no-first-run', '--mute-audio',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  browser = await launching;
  launching = null;
  browser.on('disconnected', () => { browser = null; });
  console.log('[Pup] ✓ Browser ready');
  return browser;
}

/**
 * استخراج m3u8 من صفحة embed واحدة
 */
async function extractFromEmbed(embedUrl) {
  const streams = [];
  const subs = [];
  let page = null;

  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setUserAgent(UA);
    await page.setViewport({ width: 1280, height: 720 });
    // عدم تحميل الصور لتسريع
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (req.resourceType() === 'image') return req.abort();
      // حظر نطاقات الإعلانات فقط
      if (AD_RE.test(req.url())) return req.abort();
      req.continue();
    });

    // ═══ مراقب الردود: يلتقط m3u8 + subs + JSON ═══
    page.on('response', async (res) => {
      try {
        const url = res.url();
        const st = res.status();
        if (st < 200 || st >= 400) return;
        if (AD_RE.test(url)) return;
        const ct = res.headers()['content-type'] || '';

        // m3u8
        if (HLS_RE.test(url) || ct.includes('mpegurl')) {
          console.log(`[Pup] 🎬 HLS: ${url.substring(0, 150)}`);
          let isMaster = false;
          try { const t = await res.text(); isMaster = t.includes('#EXT-X-STREAM-INF'); } catch {}
          streams.push({ url, type: 'hls', master: isMaster });
        }
        // mp4 (ليس صور مصغرة)
        if (MP4_RE.test(url) && !url.includes('thumb') && !url.includes('poster')) {
          console.log(`[Pup] 🎬 MP4: ${url.substring(0, 150)}`);
          streams.push({ url, type: 'mp4', master: false });
        }
        // ترجمات
        if (SUB_RE.test(url) || ct.includes('text/vtt') || ct.includes('subrip')) {
          console.log(`[Pup] 📝 Sub: ${url.substring(0, 120)}`);
          subs.push({ url, language: guessLang(url), type: guessSubExt(url) });
        }
        // JSON قد يحتوي على روابط m3u8 أو ترجمات
        if (ct.includes('json')) {
          try {
            const body = await res.text();
            scanJsonBody(body, streams, subs);
          } catch {}
        }
      } catch {}
    });

    // ═══ تحميل الصفحة ═══
    console.log(`[Pup] → ${embedUrl}`);
    await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // انتظار ثابت لتحميل السكربتات + Cloudflare challenge
    await delay(4000);

    // ═══ النقر على زر التشغيل (وسط الشاشة) ═══
    console.log(`[Pup] Click center (play)...`);
    await page.mouse.click(640, 360);
    await delay(1000);
    // نقرة ثانية احتياطية (بعض الصفحات تفتح popup بالنقرة الأولى)
    await page.mouse.click(640, 360);

    // ═══ انتظار ظهور m3u8 ═══
    if (await waitFor(() => streams.length > 0, 15000)) {
      console.log(`[Pup] ✓ Stream captured after play click`);
      await delay(2000); // لالتقاط الترجمات أيضاً
    }

    // ═══ إذا لم نجد — حاول النقر داخل الإطارات الفرعية ═══
    if (streams.length === 0) {
      console.log(`[Pup] No stream yet — clicking inside frames...`);
      const frames = page.frames();
      for (const f of frames) {
        if (f === page.mainFrame()) continue;
        try {
          await f.click('video').catch(() => {});
          await f.evaluate(() => {
            document.querySelectorAll('video').forEach(v => v.play().catch(() => {}));
            document.querySelectorAll('[class*="play"],[class*="Play"],.jw-icon-playback,.vjs-big-play-button').forEach(b => b.click());
          }).catch(() => {});
        } catch {}
      }
      await waitFor(() => streams.length > 0, 10000);
    }

    // ═══ إذا لم نجد — جرّب تبديل السيرفر/المصدر ═══
    if (streams.length === 0) {
      console.log(`[Pup] No stream — trying server switch...`);
      try {
        const switched = await page.evaluate(() => {
          const btns = document.querySelectorAll('.server-item, [data-hash], .source-btn, .btn-server');
          const labels = Array.from(btns).map(b => b.textContent.trim());
          // انقر على ثاني مصدر إن وجد
          if (btns.length > 1) { btns[1].click(); return labels[1]; }
          if (btns.length > 0) { btns[0].click(); return labels[0]; }
          return null;
        });
        if (switched) console.log(`[Pup] Switched to: ${switched}`);
      } catch {}
      await delay(3000);
      await page.mouse.click(640, 360);
      await delay(1000);
      await page.mouse.click(640, 360);
      await waitFor(() => streams.length > 0, 12000);
    }

    // ═══ محاولة أخيرة: مسح المحتوى ═══
    if (streams.length === 0) {
      console.log(`[Pup] Scanning page JS for m3u8...`);
      for (const frame of page.frames()) {
        try {
          const found = await frame.evaluate(() => {
            const all = [];
            // video src
            document.querySelectorAll('video, video source').forEach(v => {
              const s = v.src || v.getAttribute('src') || '';
              if (s) all.push(s);
            });
            // سكربتات
            document.querySelectorAll('script').forEach(sc => {
              const t = sc.textContent || '';
              const m = t.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/g);
              if (m) all.push(...m);
            });
            return all;
          }).catch(() => []);
          for (const u of (found || [])) {
            const clean = u.replace(/\\+/g, '');
            if (HLS_RE.test(clean) && !AD_RE.test(clean)) {
              console.log(`[Pup] 🎬 HLS (scan): ${clean.substring(0, 120)}`);
              streams.push({ url: clean, type: 'hls', master: false });
            }
          }
        } catch {}
      }
    }

    // تنظيف
    await page.close().catch(() => {});
    page = null;

    if (streams.length === 0) {
      console.log(`[Pup] ✗ No streams found`);
      return null;
    }

    // اختر أفضل stream: master playlist أولاً، ثم أي hls، ثم mp4
    const best = streams.find(s => s.master) || streams.find(s => s.type === 'hls') || streams[0];
    const uniqueSubs = dedup(subs);
    console.log(`[Pup] ✓ ${best.type} + ${uniqueSubs.length} subs`);

    // استخرج الـ referer من iframe URL إذا ممكن
    let referer = new URL(embedUrl).origin;

    return { url: best.url, type: best.type, subtitles: uniqueSubs, referer };
  } catch (e) {
    console.error(`[Pup] Error:`, e.message);
    if (page) await page.close().catch(() => {});
    return null;
  }
}

// ─── Helpers ───

function guessLang(url) {
  const m = url.match(/[._/-](ar|en|fr|de|es|it|pt|tr|ru|ja|ko|zh|hi|arabic|english|french|german|spanish)/i);
  if (!m) return 'und';
  const l = m[1].toLowerCase();
  return ({ arabic: 'ar', english: 'en', french: 'fr', german: 'de', spanish: 'es' })[l] || l;
}
function guessSubExt(url) {
  const m = url.match(/\.(vtt|srt|ass|ssa)/i);
  return m ? m[1].toLowerCase() : 'vtt';
}

function scanJsonBody(body, streams, subs) {
  // m3u8 URLs في JSON
  const hls = body.match(/https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/g);
  if (hls) {
    for (const u of hls) {
      const c = u.replace(/\\+/g, '').replace(/["']+$/g, '');
      if (!AD_RE.test(c) && !streams.find(s => s.url === c)) {
        console.log(`[Pup] 🎬 HLS (json): ${c.substring(0, 120)}`);
        streams.push({ url: c, type: 'hls', master: false });
      }
    }
  }
  // ترجمات في JSON
  try {
    const json = JSON.parse(body);
    walkJson(json, subs);
  } catch {}
}

function walkJson(obj, subs) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object') {
        const u = item.url || item.file || item.src || item.uri;
        if (u && typeof u === 'string' && SUB_RE.test(u)) {
          subs.push({
            url: u,
            language: (item.language || item.lang || item.srclang || 'und').substring(0, 3).toLowerCase(),
            label: item.label || item.name || undefined,
            type: guessSubExt(u),
          });
        }
        walkJson(item, subs);
      }
    }
  } else {
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') walkJson(v, subs);
    }
  }
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true; });
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitFor(fn, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (fn()) return true;
    await delay(500);
  }
  return fn();
}

// ═══ API ═══

async function puppeteerExtract(tmdbId, type = 'movie', season, episode) {
  const isTv = type === 'tv' && season && episode;
  const url = isTv
    ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`
    : `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;
  console.log(`[Pup] Start: ${url}`);
  return extractFromEmbed(url);
}

async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
    console.log('[Pup] Browser closed');
  }
}

module.exports = { puppeteerExtract, extractFromEmbed, closeBrowser };
