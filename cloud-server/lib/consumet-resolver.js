/**
 * Consumet Stream Resolver v2 — استخراج روابط m3u8 مباشرة + ترجمات
 * 
 * يجرب عدة مزودات (FlixHQ, Goku, SFlix) بالتوازي مع timeout
 * + Circuit Breaker لتجنب المزودات المعطلة
 */

const { MOVIES } = require('@consumet/extensions');

// ─── Initialize providers ───────────────────────────────
const providers = {
  flixhq: { instance: new MOVIES.FlixHQ(), name: 'FlixHQ' },
  goku:   { instance: new MOVIES.Goku(),   name: 'Goku' },
  sflix:  { instance: new MOVIES.SFlix(),   name: 'SFlix' },
};

// ─── Circuit Breaker — تتبع المزودات المعطلة ───────────
const circuitBreaker = new Map(); // provider → { failures, lastFail }
const CB_THRESHOLD = 3;          // عدد الأخطاء قبل الإيقاف
const CB_RESET_MS = 10 * 60 * 1000; // 10 دقائق قبل إعادة المحاولة

function isProviderDown(providerKey) {
  const cb = circuitBreaker.get(providerKey);
  if (!cb) return false;
  if (cb.failures >= CB_THRESHOLD) {
    if (Date.now() - cb.lastFail > CB_RESET_MS) {
      circuitBreaker.delete(providerKey); // إعادة تعيين
      return false;
    }
    return true;
  }
  return false;
}

function recordFailure(providerKey) {
  const cb = circuitBreaker.get(providerKey) || { failures: 0, lastFail: 0 };
  cb.failures++;
  cb.lastFail = Date.now();
  circuitBreaker.set(providerKey, cb);
}

function recordSuccess(providerKey) {
  circuitBreaker.delete(providerKey);
}

// ─── Timeout helper ─────────────────────────────────────
const PROVIDER_TIMEOUT = 8000; // 8 ثواني لكل مزود

function withTimeout(promise, ms, label = '') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout ${label} (${ms}ms)`)), ms)),
  ]);
}

// ─── Cache ──────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 300) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) cache.delete(k);
    }
  }
}

// ─── Title matching ─────────────────────────────────────
function normalizeTitle(title) {
  return (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  const common = wordsA.filter(w => wordsB.includes(w)).length;
  const maxLen = Math.max(wordsA.length, wordsB.length);
  return maxLen > 0 ? common / maxLen : 0;
}

/**
 * البحث في مزود Consumet وإيجاد أفضل تطابق
 */
async function findBestMatch(provider, title, type = 'movie', year) {
  const results = await provider.search(title);
  if (!results?.results?.length) return null;

  let candidates = results.results.filter(r => {
    if (type === 'movie') return r.type === 'Movie';
    return r.type === 'TV Series';
  });
  if (candidates.length === 0) candidates = results.results;

  const scored = candidates.map(r => {
    let score = titleSimilarity(title, r.title);
    if (year && r.releaseDate) {
      const rYear = r.releaseDate.includes('-') ? r.releaseDate.split('-')[0] : r.releaseDate;
      if (rYear === String(year)) score += 0.2;
    }
    return { ...r, score };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.3) return null;
  return { id: best.id, title: best.title, type: best.type, score: best.score };
}

/**
 * جلب مصادر البث من مزود واحد (مع محاولة سيرفرات متعددة)
 */
async function getStreamFromProvider(provider, mediaId, episodeId) {
  // جرب كل السيرفرات المتاحة بالترتيب
  const serverOrder = ['upcloud', 'vidcloud', 'akcloud', 'mixdrop'];
  
  let servers = [];
  try {
    servers = await provider.fetchEpisodeServers(episodeId, mediaId);
  } catch (e) {
    // بعض المزودات لا تدعم fetchEpisodeServers
  }

  // جرب السيرفرات بالترتيب
  for (const serverName of serverOrder) {
    const server = (servers || []).find(s => s.name?.toLowerCase() === serverName);
    if (server) {
      try {
        const data = await provider.fetchEpisodeSources(episodeId, mediaId, server.name);
        if (data?.sources?.length > 0) return { data, server: serverName };
      } catch (e) {
        // جرب التالي
      }
    }
  }

  // جرب بدون تحديد سيرفر
  try {
    const data = await provider.fetchEpisodeSources(episodeId, mediaId);
    if (data?.sources?.length > 0) return { data, server: 'default' };
  } catch (e) {
    // فشل
  }

  return null;
}

/**
 * محاولة استخراج بث من مزود Consumet واحد (مع timeout)
 */
async function tryProvider(providerKey, title, type, year, season, episode) {
  if (isProviderDown(providerKey)) {
    return null; // مزود معطل — تخطي
  }

  const { instance: provider, name } = providers[providerKey];
  
  try {
    // 1. بحث
    console.log(`[Consumet/${name}] Searching: "${title}" (${type})`);
    const match = await withTimeout(findBestMatch(provider, title, type, year), 5000, `${name}/search`);
    if (!match) {
      console.log(`[Consumet/${name}] No match found`);
      return null;
    }
    console.log(`[Consumet/${name}] ✓ Found: "${match.title}" (${match.id}) score=${match.score.toFixed(2)}`);

    // 2. جلب معلومات المحتوى
    const mediaInfo = await withTimeout(provider.fetchMediaInfo(match.id), 5000, `${name}/info`);
    if (!mediaInfo?.episodes?.length) {
      console.log(`[Consumet/${name}] No episodes found`);
      return null;
    }

    // 3. تحديد الحلقة المطلوبة
    let episodeId;
    if (type === 'tv' && season && episode) {
      const ep = mediaInfo.episodes.find(e => e.season === season && e.number === episode);
      if (ep) {
        episodeId = ep.id;
      } else {
        // fallback: ابحث بالترتيب
        const seasonEps = mediaInfo.episodes.filter(e => e.season === season);
        if (seasonEps.length >= episode) {
          episodeId = seasonEps[episode - 1]?.id;
        }
      }
      if (!episodeId) {
        console.log(`[Consumet/${name}] Episode S${season}E${episode} not found`);
        return null;
      }
    } else {
      episodeId = mediaInfo.episodes[0].id;
    }

    console.log(`[Consumet/${name}] Episode ID: ${episodeId}`);

    // 4. جلب مصادر البث
    const result = await withTimeout(getStreamFromProvider(provider, match.id, episodeId), 6000, `${name}/sources`);
    if (!result?.data?.sources?.length) {
      console.log(`[Consumet/${name}] No stream sources`);
      recordFailure(providerKey);
      return null;
    }

    const streamData = result.data;
    const source = streamData.sources.find(s => s.quality === 'auto')
      || streamData.sources.find(s => s.quality === '1080p')
      || streamData.sources[0];

    if (!source?.url) {
      recordFailure(providerKey);
      return null;
    }

    console.log(`[Consumet/${name}] ✓ Stream: ${result.server} — ${source.quality} — ${source.url.substring(0, 80)}...`);
    recordSuccess(providerKey);

    const qualities = {};
    for (const s of streamData.sources) {
      const key = s.quality === 'auto' ? 'auto' : s.quality?.replace('p', '') || 'unknown';
      qualities[key] = { url: s.url, type: 'hls' };
    }

    return {
      provider: `consumet/${name.toLowerCase()}/${result.server}`,
      url: source.url,
      type: 'hls',
      qualities,
      subtitles: (streamData.subtitles || []).map(sub => ({
        language: sub.lang || 'Unknown',
        url: sub.url,
      })),
      headers: streamData.headers || {},
    };
  } catch (err) {
    console.log(`[Consumet/${name}] Error: ${err.message}`);
    recordFailure(providerKey);
    return null;
  }
}

/**
 * الدالة الرئيسية — جرب كل المزودات بالتوازي مع timeout عام
 */
async function resolveConsumetStream({ tmdbId, title, type = 'movie', year, season, episode }) {
  if (!title) return null;

  const cacheKey = `stream_${type}_${tmdbId}_s${season || 0}e${episode || 0}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[Consumet] ✓ Cache hit: ${cacheKey}`);
    return cached;
  }

  // تحقق إذا كل المزودات معطلة
  const availableProviders = Object.keys(providers).filter(k => !isProviderDown(k));
  if (availableProviders.length === 0) {
    console.log(`[Consumet] ✗ All providers are down (circuit breaker active)`);
    return null;
  }

  console.log(`[Consumet] Trying ${availableProviders.length} providers for "${title}" (${type})`);

  try {
    // جرب كل المزودات المتاحة بالتوازي — أول نتيجة ناجحة تُرجع
    const result = await withTimeout(
      Promise.any(
        availableProviders.map(key => 
          tryProvider(key, title, type, year, season, episode).then(r => {
            if (r) return r;
            throw new Error('no result'); // لجعل Promise.any يتجاهلها
          })
        )
      ),
      PROVIDER_TIMEOUT,
      'all-providers'
    );

    if (result) {
      setCache(cacheKey, result);
      console.log(`[Consumet] ✓ Resolved via ${result.provider}`);
      console.log(`[Consumet]   URL: ${result.url.substring(0, 100)}`);
      console.log(`[Consumet]   Subtitles: ${result.subtitles.length}`);
      return result;
    }
  } catch (err) {
    // Promise.any AggregateError أو Timeout
    const msg = err.errors ? `All ${availableProviders.length} providers failed` : err.message;
    console.log(`[Consumet] ✗ ${msg}`);
  }

  return null;
}

module.exports = { resolveConsumetStream };
