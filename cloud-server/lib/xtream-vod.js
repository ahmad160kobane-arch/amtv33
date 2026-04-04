/**
 * Xtream VOD & Series API
 * Fetches movies and series from IPTV provider with in-memory caching
 */

const { XTREAM } = require('./xtream');

// ─────────────────────────── Text helpers ──────────────────────────────────

// Cleans broken URLs from Xtream (spaces, bad chars) — returns '' if invalid
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || !trimmed.startsWith('http')) return '';
  try {
    return encodeURI(decodeURI(trimmed));
  } catch {
    return trimmed.replace(/ /g, '%20');
  }
}

// Remove provider tags like [Ar Movies 2025], [EN Series], etc. and clean whitespace
function cleanName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/\[.*?\]/g, '')   // remove [Any Tag]
    .replace(/\s{2,}/g, ' ')   // collapse multiple spaces
    .trim();
}

// Prioritize Arabic text in mixed Arabic/English fields (e.g. plot)
function arabicFirst(text) {
  if (!text || typeof text !== 'string') return '';
  // Clean escaped newlines from IPTV data
  let clean = text.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  // Check if text contains Arabic
  const hasArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(clean);
  if (!hasArabic) return clean;
  // Split into sentences/paragraphs, find Arabic portions
  const parts = clean.split(/(?<=\.)\s+|\n+/);
  const arabicParts = parts.filter(p => /[\u0600-\u06FF]/.test(p));
  const englishParts = parts.filter(p => !/[\u0600-\u06FF]/.test(p) && p.trim());
  if (arabicParts.length === 0) return clean;
  // Arabic first, then English
  return [...arabicParts, ...englishParts].join('\n').trim();
}

// Extract Arabic genre names: "Comedy / كوميدي" → "كوميدي" (keep both if no Arabic)
function arabicGenre(genre) {
  if (!genre || typeof genre !== 'string') return '';
  const parts = genre.split(/[,\/]/).map(p => p.trim()).filter(Boolean);
  const arabic = parts.filter(p => /[\u0600-\u06FF]/.test(p));
  if (arabic.length > 0) return arabic.join(' , ');
  return parts.join(' , ');
}

// Translate IPTV provider category names to Arabic
const CAT_AR = {
  // ── VOD Categories ──
  'English 2026':              'أفلام إنجليزية 2026',
  'English Multi-Sub 2026':    'إنجليزية مترجمة 2026',
  'English AR Sub 2026':       'إنجليزية مترجمة عربي 2026',
  'English AR Sub 2025':       'إنجليزية مترجمة عربي 2025',
  'English Multi-Sub 2025':    'إنجليزية مترجمة 2025',
  'English 2025':              'أفلام إنجليزية 2025',
  'Netflix| Multi-Language':   'نتفلكس',
  'Arabic Movies 2025':        'أفلام عربية 2025',
  'English AR Sub':            'إنجليزية مترجمة عربي',
  'English Steven Seagal':     'أفلام ستيفن سيغال',
  'English Multi-Sub':         'إنجليزية مترجمة',
  'English Movies':            'أفلام إنجليزية',
  'Turkish AR Sub':            'تركية مترجمة عربي',
  'India AR Sub':              'هندية مترجمة عربي',
  'Asia AR Sub':               'آسيوية مترجمة عربي',
  'Animation AR Sub':          'أنيميشن مترجم عربي',
  'Arabic Movies':             'أفلام عربية',
  'Arabic Masrahyat':          'مسرحيات عربية',
  'Arabic Movies مدبلج':       'أفلام عربية مدبلجة',
  'Arabic Animation':          'كرتون عربي',
  'Persian Original':          'فارسية أصلية',
  'Persian Dubbed':            'فارسية مدبلجة',
  'Persian Classic':           'فارسية كلاسيكية',
  'Persian Subbed':            'فارسية مترجمة',
  'Kurdish KRD Sub':           'كردية مترجمة',
  'Kurd Doblaj Sorani':        'كردية سوراني مدبلجة',
  'Kurd Doblaj Kurmanji':      'كردية كرمانجي مدبلجة',
  'Kurd Cartoon':              'كرتون كردي',
  'Kurd Documentary':          'وثائقي كردي',
  'France Movies':             'أفلام فرنسية',
  'Germany Movies':            'أفلام ألمانية',
  'Netherlands Movies':        'أفلام هولندية',
  'Turkish Movies':            'أفلام تركية',
  'Spian Movies':              'أفلام إسبانية',
  'Italy Movies':              'أفلام إيطالية',
  'Poland Movies':             'أفلام بولندية',
  // ── Series Categories ──
  'Ramadan 2026':              'رمضان 2026',
  'Watching Now Arabic':       'يُعرض الآن عربي',
  'Watching Now Turkish':      'يُعرض الآن تركي',
  'Watching Now English':      'يُعرض الآن إنجليزي',
  'Series Multi-Sub':          'مسلسلات مترجمة',
  'English Series [Ar Sub]':   'إنجليزية مترجمة عربي',
  'ِِِAsia Ar Sub':            'آسيوية مترجمة عربي',
  'Animation Series [Ar Sub]': 'أنيميشن مترجم عربي',
  'Ramadan Series':            'مسلسلات رمضان',
  'Egypt Series':              'مسلسلات مصرية',
  'Syria Series':              'مسلسلات سورية',
  'Lebanon Series':            'مسلسلات لبنانية',
  'Arabic Series':             'مسلسلات عربية',
  'Khaliji Series':            'مسلسلات خليجية',
  'Iraq Series':               'مسلسلات عراقية',
  'Arabic Cartoon Series':     'كرتون عربي',
  'Turkish Series [Doblaj]':   'تركية مدبلجة',
  'Turkish Series [Ar Sub]':   'تركية مترجمة عربي',
  'Program Ar':                'برامج عربية',
  'Indian Series [ Ar Dub ]':  'هندية مدبلجة عربي',
  'Islamic Series':            'مسلسلات إسلامية',
  'Anime Series [Ar Sub]':     'أنمي مترجم عربي',
  'Anime Series [mdblj]':      'أنمي مدبلج',
  'Spanish Series [Ar Sub]':   'إسبانية مترجمة عربي',
  'French Series [Ar Sub]':    'فرنسية مترجمة عربي',
  'Germany Series [Ar Sub]':   'ألمانية مترجمة عربي',
  'Italy Series [Ar Sub]':     'إيطالية مترجمة عربي',
  'Scandinavia Series [Ar Sub]':'اسكندنافية مترجمة عربي',
  'Portugal Series [Ar Sub]':  'برتغالية مترجمة عربي',
  'Poland Series [Pl: Ar Sub]':'بولندية مترجمة عربي',
  'Indian Series':             'مسلسلات هندية',
  'Persian Series Original':   'فارسية أصلية',
  'Persian Series Foreign':    'فارسية أجنبية',
  'Turkish Series [Per Sub]':  'تركية مترجمة فارسي',
  'Kurdish Series Sorani':     'كردية سوراني',
  'Kurdish Series Kurmanji':   'كردية كرمانجي',
  'Kurdish Series Cartoon':    'كرتون كردي',
  'Series [Krd Sub]':          'مترجمة كردي',
  'E-Parwarda':                'تعليمي',
  'Quran ☪':                   'القرآن الكريم',
};
function translateCategory(name) {
  if (!name) return 'عام';
  // Direct match
  if (CAT_AR[name]) return CAT_AR[name];
  // Trim and try again
  const trimmed = name.trim();
  if (CAT_AR[trimmed]) return CAT_AR[trimmed];
  // If already Arabic, return as-is
  if (/[\u0600-\u06FF]/.test(trimmed)) return trimmed;
  // Fallback: return original
  return trimmed;
}

// Detect if episode title is just a filename like "Show.S1.E1" or "show_s01e05"
function isFilenameLike(title) {
  if (!title) return true;
  return /^[A-Za-z0-9._\-]+\.[Ss]\d+\.?[Ee]\d+/.test(title) ||
         /^[A-Za-z0-9._\-]+_[Ss]\d+[Ee]\d+/.test(title) ||
         /^[Ee]p?\s*\d+$/i.test(title) ||
         /^\d+$/.test(title);
}

const CACHE_TTL   = 30 * 60 * 1000; // 30 min
const SHORT_TTL   =  5 * 60 * 1000; //  5 min
const cache       = new Map();

function getCached(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > e.ttl) { cache.delete(key); return null; }
  return e.data;
}
function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, ts: Date.now(), ttl });
}

async function apiCall(action, params = {}) {
  const q = new URLSearchParams({
    username: XTREAM.user,
    password: XTREAM.pass,
    action,
    ...params,
  });
  const url = `${XTREAM.primary}/player_api.php?${q}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
    signal : AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─────────────────────────────── VOD (Movies) ────────────────────────────────

async function getVodCategories() {
  const key = 'vod_cats';
  const cached = getCached(key);
  if (cached) return cached;
  const data = await apiCall('get_vod_categories');
  const cats = (Array.isArray(data) ? data : []).map(c => ({
    id  : String(c.category_id),
    name: translateCategory(c.category_name),
  }));
  setCache(key, cats);
  return cats;
}

const RAW_TTL = 60 * 60 * 1000; // 1 hour for raw full lists

async function _rawVodStreams(categoryId) {
  const rawKey = `vod_raw_${categoryId || 'all'}`;
  const cached = getCached(rawKey);
  if (cached) return cached;
  let streams = await apiCall('get_vod_streams', categoryId ? { category_id: String(categoryId) } : {});
  if (!Array.isArray(streams)) streams = [];
  setCache(rawKey, streams, RAW_TTL);
  return streams;
}

async function getVodStreams({ categoryId, page = 1, limit = 20, search } = {}) {
  const key = `vod_streams_${categoryId || 'all'}_${page}_${limit}_${search || ''}`;
  const cached = getCached(key);
  if (cached) return cached;

  let streams = await _rawVodStreams(categoryId);
  if (!Array.isArray(streams)) streams = [];

  if (search) {
    const q = search.toLowerCase();
    streams = streams.filter(s => (s.name || '').toLowerCase().includes(q));
  }

  const total  = streams.length;
  const start  = (page - 1) * limit;
  const paged  = streams.slice(start, start + limit);

  const items = paged.map(s => ({
    id           : String(s.stream_id),
    name         : cleanName(s.name),
    poster       : sanitizeUrl(s.stream_icon),
    rating       : s.rating ? String(s.rating) : (s.rating_5based ? String(s.rating_5based) : ''),
    year         : s.releasedate ? String(s.releasedate).substring(0, 4)
                 : s.added ? new Date(Number(s.added) * 1000).getFullYear().toString() : '',
    category_id  : String(s.category_id || ''),
    ext          : s.container_extension || 'mp4',
    vod_type     : 'movie',
  }));

  const result = { items, page, total, hasMore: start + limit < total };
  setCache(key, result, SHORT_TTL);
  return result;
}

async function getVodInfo(vodId) {
  const key = `vod_info_${vodId}`;
  const cached = getCached(key);
  if (cached) return cached;

  const data = await apiCall('get_vod_info', { vod_id: String(vodId) });
  const info  = data.info || {};
  const movie = data.movie_data || {};

  const poster   = sanitizeUrl(info.movie_image) || sanitizeUrl(info.cover_big);
  const bp = info.backdrop_path;
  const backdrop = sanitizeUrl(Array.isArray(bp) ? bp[0] : bp) || poster;

  const result = {
    id          : String(movie.stream_id || vodId),
    name        : cleanName(info.name || movie.name || ''),
    o_name      : cleanName(info.o_name || ''),
    poster,
    backdrop,
    plot        : arabicFirst(info.plot || info.description || ''),
    cast        : info.cast || info.actors || '',
    director    : info.director || '',
    genre       : arabicGenre(info.genre),
    genre_raw   : info.genre || '',
    rating      : info.rating || '',
    rating5     : info.rating_5based || null,
    year        : info.year || (info.releasedate ? info.releasedate.substring(0, 4) : ''),
    releaseDate : info.releasedate || info.release_date || '',
    runtime     : info.duration || '',
    duration_secs: info.duration_secs || 0,
    country     : info.country || '',
    tmdb_id     : info.tmdb_id || null,
    ext         : movie.container_extension || 'mp4',
    vod_type    : 'movie',
    trailer     : info.youtube_trailer || '',
    age         : info.age || info.mpaa_rating || info.mpaa || '',
  };

  setCache(key, result);
  return result;
}

// ─────────────────────────────── Series ──────────────────────────────────────

async function getSeriesCategories() {
  const key = 'series_cats';
  const cached = getCached(key);
  if (cached) return cached;
  const data = await apiCall('get_series_categories');
  const cats = (Array.isArray(data) ? data : []).map(c => ({
    id  : String(c.category_id),
    name: translateCategory(c.category_name),
  }));
  setCache(key, cats);
  return cats;
}

async function _rawSeriesList(categoryId) {
  const rawKey = `series_raw_${categoryId || 'all'}`;
  const cached = getCached(rawKey);
  if (cached) return cached;
  let list = await apiCall('get_series', categoryId ? { category_id: String(categoryId) } : {});
  if (!Array.isArray(list)) list = [];
  setCache(rawKey, list, RAW_TTL);
  return list;
}

async function getSeriesList({ categoryId, page = 1, limit = 20, search } = {}) {
  const key = `series_list_${categoryId || 'all'}_${page}_${limit}_${search || ''}`;
  const cached = getCached(key);
  if (cached) return cached;

  let list = await _rawSeriesList(categoryId);
  if (!Array.isArray(list)) list = [];

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(s => (s.name || '').toLowerCase().includes(q));
  }

  const total = list.length;
  const start = (page - 1) * limit;
  const paged = list.slice(start, start + limit);

  const items = paged.map(s => ({
    id          : String(s.series_id),
    name        : cleanName(s.name),
    poster      : sanitizeUrl(s.cover) || sanitizeUrl(s.series_icon),
    rating      : s.rating || '',
    year        : s.releaseDate ? s.releaseDate.substring(0, 4) : '',
    genre       : arabicGenre(s.genre),
    category_id : String(s.category_id || ''),
    vod_type    : 'series',
  }));

  const result = { items, page, total, hasMore: start + limit < total };
  setCache(key, result, SHORT_TTL);
  return result;
}

async function getSeriesInfo(seriesId) {
  const key = `series_info_${seriesId}`;
  const cached = getCached(key);
  if (cached) return cached;

  const data    = await apiCall('get_series_info', { series_id: String(seriesId) });
  const info    = data.info || {};
  const rawEps  = data.episodes || {};

  const poster   = sanitizeUrl(info.cover) || sanitizeUrl(info.cover_big);
  const bp2 = info.backdrop_path;
  const backdrop = sanitizeUrl(Array.isArray(bp2) ? bp2[0] : bp2) || poster;

  const seasons = [];
  for (const [seasonNum, eps] of Object.entries(rawEps)) {
    const sNum = Number(seasonNum);
    const epList = (Array.isArray(eps) ? eps : []).map(e => {
      const ei  = e.info || {};
      const epn = Number(e.episode_num || 1);
      const rawTitle = e.title || '';
      // Use Arabic fallback when title is just a filename
      const title = (rawTitle && !isFilenameLike(rawTitle))
        ? rawTitle
        : `الحلقة ${epn}`;
      return {
        id           : String(e.id),
        episode      : epn,
        title,
        rawTitle     : rawTitle,
        poster       : sanitizeUrl(ei.movie_image),
        plot         : arabicFirst(ei.plot || ''),
        duration     : ei.duration || '',
        duration_secs: ei.duration_secs || 0,
        released     : ei.releasedate || '',
        ext          : e.container_extension || 'mp4',
        season       : sNum,
        resolution   : ei.video ? `${ei.video.width || 0}x${ei.video.height || 0}` : '',
      };
    });
    seasons.push({ season: sNum, episodes: epList });
  }
  seasons.sort((a, b) => a.season - b.season);

  const result = {
    id          : String(seriesId),
    name        : cleanName(info.name),
    o_name      : cleanName(info.o_name || ''),
    poster,
    backdrop,
    plot        : arabicFirst(info.plot || ''),
    cast        : info.cast || '',
    director    : info.director || '',
    genre       : arabicGenre(info.genre),
    genre_raw   : info.genre || '',
    rating      : info.rating || '',
    rating5     : info.rating_5based || null,
    year        : info.releaseDate ? info.releaseDate.substring(0, 4) : '',
    releaseDate : info.releaseDate || '',
    vod_type    : 'series',
    trailer     : info.youtube_trailer || '',
    episode_run_time: info.episode_run_time || '',
    seasons,
  };

  setCache(key, result);
  return result;
}

// ────────────────────────── Home (latest + popular) ──────────────────────────

async function getHome() {
  const key = 'xtream_vod_home';
  const cached = getCached(key);
  if (cached) return cached;

  const [vodResult, seriesResult] = await Promise.all([
    getVodStreams({ page: 1, limit: 20 }),
    getSeriesList({ page: 1, limit: 20 }),
  ]);

  // Fetch a few category slices for genre rows
  const [vodCats, seriesCats] = await Promise.all([
    getVodCategories(),
    getSeriesCategories(),
  ]);

  const result = {
    latestMovies : vodResult.items.slice(0, 15),
    latestSeries : seriesResult.items.slice(0, 15),
    vodCategories   : vodCats.slice(0, 30),
    seriesCategories: seriesCats.slice(0, 30),
  };

  setCache(key, result, SHORT_TTL);
  return result;
}

// ─────────────────────────────── Search ──────────────────────────────────────

async function search(query, page = 1, limit = 20) {
  const key = `search_${query}_${page}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [movies, series] = await Promise.all([
    getVodStreams({ search: query, page, limit }),
    getSeriesList({ search: query, page, limit }),
  ]);

  // Interleave results to show both types, then cap at limit
  const items = [];
  const maxLen = Math.max(movies.items.length, series.items.length);
  for (let i = 0; i < maxLen && items.length < limit; i++) {
    if (i < movies.items.length && items.length < limit) items.push(movies.items[i]);
    if (i < series.items.length && items.length < limit) items.push(series.items[i]);
  }
  const result = { items, page, hasMore: movies.hasMore || series.hasMore };
  setCache(key, result, SHORT_TTL);
  return result;
}

// ─────────────────────────────── Categories with movies (single call) ─────────────────

async function getVodByCategory({ perCategory = 12, maxCategories = 40, filter = '' } = {}) {
  const key = `vod_by_cat_${perCategory}_${maxCategories}_${filter}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [allStreams, cats] = await Promise.all([
    _rawVodStreams(),
    getVodCategories(),
  ]);

  // Group streams by category_id
  const grouped = {};
  for (const s of allStreams) {
    const cid = String(s.category_id || '');
    if (!cid) continue;
    if (!grouped[cid]) grouped[cid] = [];
    if (grouped[cid].length < perCategory) grouped[cid].push(s);
  }

  // Filter categories by keyword if provided
  const FILTERS = {
    kids: /kid|child|cartoon|anim|family|disney|nick|أطفال|كرتون|عائل|ديزني|toddler|junior|baby/i,
  };
  const filterRe = filter && FILTERS[filter] ? FILTERS[filter] : null;

  const categories = [];
  for (const cat of cats) {
    if (filterRe && !filterRe.test(cat.name)) continue;
    const streams = grouped[cat.id];
    if (!streams || streams.length < 1) continue;
    categories.push({
      id: cat.id,
      name: cat.name,
      items: streams.map(s => ({
        id: String(s.stream_id),
        name: cleanName(s.name),
        poster: sanitizeUrl(s.stream_icon),
        rating: s.rating ? String(s.rating) : '',
        year: s.added ? new Date(Number(s.added) * 1000).getFullYear().toString() : '',
        category_id: String(s.category_id || ''),
        ext: s.container_extension || 'mp4',
        vod_type: 'movie',
      })),
    });
    if (categories.length >= maxCategories) break;
  }

  const result = { categories, total: cats.length };
  setCache(key, result, SHORT_TTL);
  return result;
}

// ─────────────────────────── Stream URL builder ───────────────────────────────

function buildVodStreamUrl(streamId, ext = 'mp4') {
  return `${XTREAM.primary}/movie/${XTREAM.user}/${XTREAM.pass}/${streamId}.${ext}`;
}

function buildSeriesStreamUrl(episodeId, ext = 'mp4') {
  return `${XTREAM.primary}/series/${XTREAM.user}/${XTREAM.pass}/${episodeId}.${ext}`;
}

module.exports = {
  getVodCategories,
  getVodStreams,
  getVodInfo,
  getSeriesCategories,
  getSeriesList,
  getSeriesInfo,
  getHome,
  getVodByCategory,
  search,
  buildVodStreamUrl,
  buildSeriesStreamUrl,
};
