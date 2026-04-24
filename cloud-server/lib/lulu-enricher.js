/**
 * LuluStream + TMDB Enricher
 *
 * يجلب البيانات الوصفية الغنية (صور، قصة، ممثلون، تقييم...) من TMDB
 * ويحتفظ بـ file_code/hlsUrl الخاصة بـ LuluStream لتشغيل الفيديو فقط
 */

const config = require('../config');

const TMDB_BASE  = config.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY   = config.TMDB_API_KEY;
const IMG_BASE   = 'https://image.tmdb.org/t/p';

// ─── Cache داخلي (عنوان → نتيجة TMDB) — 24 ساعة ────────────────────────────
const _cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCached(key) {
  const e = _cache.get(key);
  if (!e) return undefined;
  if (Date.now() - e.ts > CACHE_TTL) { _cache.delete(key); return undefined; }
  return e.data; // قد يكون null (بحث سابق لم يجد نتيجة)
}
function setCache(key, data) {
  _cache.set(key, { data, ts: Date.now() });
}

// ─── تنظيف العنوان قبل البحث ─────────────────────────────────────────────────
function cleanTitle(title) {
  return (title || '')
    .replace(/\[.*?\]/g, '')       // [AR Sub] وما شابه
    .replace(/\(.*?\)/g, '')       // (2024) وما شابه
    .replace(/\d{4}$/g, '')        // سنة في النهاية
    .replace(/Season\s*\d+/gi, '') // Season 1
    .replace(/الموسم\s*\d+/g, '')  // الموسم 2
    .replace(/[_\-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── بحث TMDB وإرجاع بيانات الإثراء ─────────────────────────────────────────

/**
 * يبحث في TMDB عن عنوان ويُرجع أفضل نتيجة للإثراء
 * يُرجع null إذا لم يجد شيئاً
 */
async function searchTmdbEnrich(title, vodType = null) {
  const cleanedTitle = cleanTitle(title);
  if (!cleanedTitle || cleanedTitle.length < 2) return null;

  const cacheKey = `enrich_${cleanedTitle.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached; // null = بحثنا ولم نجد

  try {
    const url = `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanedTitle)}&language=ar-SA&page=1&include_adult=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) { setCache(cacheKey, null); return null; }

    const data = await res.json();
    let results = (data.results || []).filter(r =>
      (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path
    );

    if (!results.length) { setCache(cacheKey, null); return null; }

    // فضّل النوع المطابق (فيلم أو مسلسل) إن كان معروفاً
    if (vodType) {
      const prefer = vodType === 'movie' ? 'movie' : 'tv';
      const match  = results.find(r => r.media_type === prefer);
      if (match) results = [match, ...results.filter(r => r !== match)];
    }

    const best = results[0];

    const enrichment = {
      tmdb_id    : String(best.id),
      tmdb_type  : best.media_type,                          // 'movie' | 'tv'
      tmdb_title : best.title || best.name || '',
      poster     : best.poster_path   ? `${IMG_BASE}/w500${best.poster_path}`   : null,
      backdrop   : best.backdrop_path ? `${IMG_BASE}/w1280${best.backdrop_path}` : null,
      plot       : best.overview || '',
      year       : (best.release_date || best.first_air_date || '').substring(0, 4),
      rating     : best.vote_average ? Number(best.vote_average).toFixed(1) : '',
    };

    setCache(cacheKey, enrichment);
    return enrichment;
  } catch (e) {
    console.error(`[LuluEnricher] TMDB search error "${title}": ${e.message}`);
    setCache(cacheKey, null);
    return null;
  }
}

// ─── تفاصيل TMDB الكاملة (cast, genres, seasons...) ─────────────────────────

/**
 * يجلب تفاصيل TMDB الكاملة لـ tmdb_id معروف
 */
async function fetchTmdbFullDetail(tmdbId, tmdbType = 'movie') {
  const type     = (tmdbType === 'tv' || tmdbType === 'series') ? 'tv' : 'movie';
  const cacheKey = `detail_${type}_${tmdbId}`;
  const cached   = getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const url = `${TMDB_BASE}/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=ar-SA&append_to_response=credits,external_ids`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) { setCache(cacheKey, null); return null; }

    const d = await res.json();
    if (!d || d.success === false) { setCache(cacheKey, null); return null; }

    const genres    = (d.genres || []).map(g => g.name);
    const cast      = (d.credits?.cast  || []).slice(0, 12).map(c => c.name).join(', ');
    const directors = (d.credits?.crew  || []).filter(c => c.job === 'Director').map(c => c.name).join(', ');
    const countries = (d.production_countries || []).map(c => c.name).join(', ');

    const result = {
      tmdb_id      : String(d.id),
      tmdb_type    : type,
      title        : d.title || d.name || '',
      poster       : d.poster_path   ? `${IMG_BASE}/w500${d.poster_path}`   : null,
      backdrop     : d.backdrop_path ? `${IMG_BASE}/w1280${d.backdrop_path}` : null,
      plot         : d.overview || '',
      year         : (d.release_date || d.first_air_date || '').substring(0, 4),
      rating       : d.vote_average ? Number(d.vote_average).toFixed(1) : '',
      genres,
      genre        : genres.join(' • '),
      cast,
      director     : directors,
      country      : countries,
      runtime      : d.runtime          ? `${d.runtime} دقيقة`
                   : d.episode_run_time?.[0] ? `${d.episode_run_time[0]} دقيقة`
                   : '',
      seasons_count: d.number_of_seasons  || 0,
      episodes_count: d.number_of_episodes || 0,
      imdb_id      : d.external_ids?.imdb_id || '',
      tagline      : d.tagline || '',
    };

    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.error(`[LuluEnricher] TMDB detail error ${tmdbId}: ${e.message}`);
    setCache(cacheKey, null);
    return null;
  }
}

// ─── إثراء عنصر واحد ─────────────────────────────────────────────────────────

async function enrichItem(item) {
  const enrich = await searchTmdbEnrich(item.title, item.vod_type);
  if (!enrich) return item;

  return {
    ...item,
    tmdb_id   : enrich.tmdb_id,
    tmdb_type : enrich.tmdb_type,
    tmdb_title: enrich.tmdb_title,
    poster    : enrich.poster   || item.poster,   // TMDB أولاً، LuluStream احتياطي
    backdrop  : enrich.backdrop || item.poster,
    plot      : enrich.plot     || '',
    year      : enrich.year     || item.year  || '',
    rating    : enrich.rating   || item.rating || '',
  };
}

// ─── إثراء دفعة (مع تحكم في المعدل) ────────────────────────────────────────

/**
 * يُثري قائمة من العناصر بتزامن محدود لتجنب rate limit
 * concurrency=6 → ~36 طلب/5 ثواني ≈ ضمن حدود TMDB (40 req/10s)
 */
async function enrichBatch(items, { concurrency = 6, delayMs = 200 } = {}) {
  const result = [];
  let enriched = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch   = items.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(it => enrichItem(it)));
    result.push(...results);
    enriched += results.filter(r => r.tmdb_id).length;

    if (i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  console.log(`[LuluEnricher] Enriched ${enriched}/${items.length} items from TMDB`);
  return result;
}

module.exports = { searchTmdbEnrich, fetchTmdbFullDetail, enrichItem, enrichBatch };
