/**
 * Embed Scraper — استخراج روابط m3u8/mp4 مباشرة من صفحات Embed
 * 
 * عندما @movie-web/providers يفشل، نجرب نستخرج الرابط يدوياً
 * من صفحات embed.su / vidlink / autoembed / vidsrc.cc ...
 * 
 * الآلية:
 * 1. جلب HTML الصفحة
 * 2. البحث عن m3u8 / mp4 في السكربتات والمتغيرات
 * 3. إذا الصفحة تحمّل API داخلي — نستدعيه مباشرة
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT = 10000;

/**
 * جلب صفحة ويب مع متابعة التحويلات
 */
function fetchPage(url, referer, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));

    const isHttps = url.startsWith('https');
    const mod = isHttps ? https : http;
    const parsed = new URL(url);

    const req = mod.get(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': referer || parsed.origin,
        'Origin': parsed.origin,
      },
      timeout: TIMEOUT,
      rejectUnauthorized: false,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        fetchPage(redirectUrl, referer || url, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * جلب JSON من API
 */
function fetchJson(url, referer, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const mod = isHttps ? https : http;
    const parsed = new URL(url);

    const req = mod.get(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, */*',
        'Referer': referer || parsed.origin,
        'Origin': parsed.origin,
        ...extraHeaders,
      },
      timeout: TIMEOUT,
      rejectUnauthorized: false,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        fetchJson(redirectUrl, referer || url, extraHeaders).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ═══════════════════════════════════════════════════════
// استخراج m3u8/mp4 من النص (HTML / JS)
// ═══════════════════════════════════════════════════════

function extractStreamUrls(text) {
  const urls = new Set();

  // m3u8 URLs
  const m3u8Regex = /https?:\/\/[^\s"'<>\]\\)]+\.m3u8[^\s"'<>\]\\)]*/gi;
  const m3u8Matches = text.match(m3u8Regex) || [];
  for (const u of m3u8Matches) {
    const clean = u.replace(/["'\\;,}\])]+$/, '');
    if (!clean.includes('ad') && !clean.includes('banner')) urls.add(clean);
  }

  // mp4 URLs (direct video files)
  const mp4Regex = /https?:\/\/[^\s"'<>\]\\)]+\.mp4[^\s"'<>\]\\)]*/gi;
  const mp4Matches = text.match(mp4Regex) || [];
  for (const u of mp4Matches) {
    const clean = u.replace(/["'\\;,}\])]+$/, '');
    if (!clean.includes('ad') && !clean.includes('banner') && !clean.includes('thumbnail')) urls.add(clean);
  }

  return [...urls];
}

// ═══════════════════════════════════════════════════════
// مستخرجات خاصة بكل مصدر
// ═══════════════════════════════════════════════════════

/**
 * embed.su — يحمّل تشفير base64 في السكربتات يحتوي على m3u8
 */
async function scrapeEmbedSu(embedUrl) {
  try {
    const html = await fetchPage(embedUrl);
    
    // ابحث عن بيانات مشفرة base64 في السكربتات
    const base64Regex = /atob\(["']([A-Za-z0-9+/=]+)["']\)/g;
    let match;
    while ((match = base64Regex.exec(html)) !== null) {
      try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf8');
        const found = extractStreamUrls(decoded);
        if (found.length > 0) {
          return { url: found[0], type: found[0].includes('.m3u8') ? 'hls' : 'mp4', referer: embedUrl };
        }
      } catch {}
    }

    // ابحث مباشرة في HTML
    const found = extractStreamUrls(html);
    if (found.length > 0) {
      return { url: found[0], type: found[0].includes('.m3u8') ? 'hls' : 'mp4', referer: embedUrl };
    }

    // ابحث عن hash/token في الصفحة واستدعِ API
    const hashMatch = html.match(/hash["':\s]+["']([a-f0-9]{32,})["']/i);
    if (hashMatch) {
      const parsed = new URL(embedUrl);
      const apiUrl = `${parsed.origin}/api/e/${hashMatch[1]}`;
      try {
        const data = await fetchJson(apiUrl, embedUrl);
        if (data.source) return { url: data.source, type: data.source.includes('.m3u8') ? 'hls' : 'mp4', referer: embedUrl };
        if (data.file) return { url: data.file, type: data.file.includes('.m3u8') ? 'hls' : 'mp4', referer: embedUrl };
      } catch {}
    }

    return null;
  } catch (e) {
    console.log(`[Scraper] embed.su error: ${e.message}`);
    return null;
  }
}

/**
 * عام — جلب الصفحة واستخراج أي m3u8/mp4
 */
async function scrapeGeneric(embedUrl) {
  try {
    const html = await fetchPage(embedUrl);

    // ابحث عن JSON مضمن يحتوي على source / file / url
    const jsonBlocks = html.match(/\{[^{}]*(?:["'](?:source|sources|file|url|stream|playlist|hls|video_url)["'])[^{}]*\}/gi) || [];
    for (const block of jsonBlocks) {
      const found = extractStreamUrls(block);
      if (found.length > 0) {
        return { url: found[0], type: found[0].includes('.m3u8') ? 'hls' : 'mp4', referer: embedUrl };
      }
    }

    // ابحث عن base64
    const base64Regex = /(?:atob|decode)\(["']([A-Za-z0-9+/=]{20,})["']\)/g;
    let match;
    while ((match = base64Regex.exec(html)) !== null) {
      try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf8');
        const found = extractStreamUrls(decoded);
        if (found.length > 0) {
          return { url: found[0], type: found[0].includes('.m3u8') ? 'hls' : 'mp4', referer: embedUrl };
        }
      } catch {}
    }

    // ابحث مباشرة في HTML عن m3u8/mp4
    const found = extractStreamUrls(html);
    if (found.length > 0) {
      return { url: found[0], type: found[0].includes('.m3u8') ? 'hls' : 'mp4', referer: embedUrl };
    }

    // ابحث عن API endpoints داخل السكربتات
    const apiMatch = html.match(/["'](\/api\/[^"']+)["']/g);
    if (apiMatch) {
      const parsed = new URL(embedUrl);
      for (const raw of apiMatch) {
        const apiPath = raw.replace(/["']/g, '');
        try {
          const apiUrl = `${parsed.origin}${apiPath}`;
          const data = await fetchJson(apiUrl, embedUrl);
          const dataStr = JSON.stringify(data);
          const apiFound = extractStreamUrls(dataStr);
          if (apiFound.length > 0) {
            return { url: apiFound[0], type: apiFound[0].includes('.m3u8') ? 'hls' : 'mp4', referer: embedUrl };
          }
        } catch {}
      }
    }

    return null;
  } catch (e) {
    console.log(`[Scraper] generic error for ${embedUrl}: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// الدالة الرئيسية — جرب كل المصادر
// ═══════════════════════════════════════════════════════

/**
 * scrapeEmbedSources — جرب استخراج رابط مباشر من قائمة embed URLs
 * @param {Array<{url: string, name: string}>} sources
 * @returns {Promise<{url: string, type: string, referer: string, provider: string}|null>}
 */
async function scrapeEmbedSources(sources) {
  if (!sources || sources.length === 0) return null;

  console.log(`[Scraper] محاولة استخراج رابط مباشر من ${sources.length} مصدر بالتوازي...`);

  // جرب كل المصادر بالتوازي — أول نتيجة ناجحة تُرجع
  const scrapeOne = async (src) => {
    try {
      console.log(`[Scraper] جاري: ${src.name} — ${src.url.substring(0, 60)}`);

      let result = null;

      // مستخرج خاص بـ embed.su
      if (src.name === 'embed.su' || src.url.includes('embed.su')) {
        result = await scrapeEmbedSu(src.url);
      }

      // إذا فشل المستخرج الخاص أو لا يوجد — استخدم العام
      if (!result) {
        result = await scrapeGeneric(src.url);
      }

      if (result && result.url) {
        console.log(`[Scraper] ✓ نجح ${src.name}: ${result.url.substring(0, 80)}`);
        return { ...result, provider: src.name };
      }

      console.log(`[Scraper] ✗ ${src.name} — لا يوجد رابط مباشر`);
      throw new Error('no result');
    } catch (e) {
      if (e.message !== 'no result') {
        console.log(`[Scraper] ✗ ${src.name} — خطأ: ${e.message}`);
      }
      throw e;
    }
  };

  try {
    const result = await Promise.any(sources.map(src => scrapeOne(src)));
    return result;
  } catch (e) {
    // AggregateError — كل المصادر فشلت
    console.log(`[Scraper] فشل استخراج رابط مباشر من جميع المصادر`);
    return null;
  }
}

module.exports = { scrapeEmbedSources };
