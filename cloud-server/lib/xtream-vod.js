/**
 * Xtream VOD & Series API
 * Fetches movies and series from IPTV provider with in-memory caching
 */

const { XTREAM } = require('./xtream');

// ─────────────────────────── Image URL sanitizer ──────────────────────────
// Cleans broken URLs from Xtream (spaces, bad chars) — returns '' if invalid
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  // Filter 'null', 'undefined', empty, non-http
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || !trimmed.startsWith('http')) return '';
  try {
    // encodeURI preserves valid URL chars but encodes spaces and illegal chars
    return encodeURI(decodeURI(trimmed));
  } catch {
    return trimmed.replace(/ /g, '%20');
  }
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
    name: c.category_name || 'عام',
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
    name         : (s.name || '').trim(),
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
    name        : info.name || movie.name || '',
    poster,
    backdrop,
    plot        : info.plot || '',
    cast        : info.cast || '',
    director    : info.director || '',
    genre       : info.genre || '',
    rating      : info.rating || '',
    year        : info.releasedate ? info.releasedate.substring(0, 4) : '',
    runtime     : info.duration || '',
    ext         : movie.container_extension || 'mp4',
    vod_type    : 'movie',
    trailer     : info.youtube_trailer || '',
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
    name: c.category_name || 'عام',
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
    name        : (s.name || '').trim(),
    poster      : sanitizeUrl(s.cover) || sanitizeUrl(s.series_icon),
    rating      : s.rating || '',
    year        : s.releaseDate ? s.releaseDate.substring(0, 4) : '',
    genre       : s.genre || '',
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
    const epList = (Array.isArray(eps) ? eps : []).map(e => ({
      id      : String(e.id),
      episode : Number(e.episode_num || 1),
      title   : e.title || `الحلقة ${e.episode_num}`,
      poster  : sanitizeUrl((e.info || {}).movie_image),
      plot    : (e.info || {}).plot || '',
      duration: (e.info || {}).duration || '',
      released: (e.info || {}).releasedate || '',
      ext     : e.container_extension || 'mp4',
      season  : sNum,
    }));
    seasons.push({ season: sNum, episodes: epList });
  }
  seasons.sort((a, b) => a.season - b.season);

  const result = {
    id      : String(seriesId),
    name    : info.name || '',
    poster,
    backdrop,
    plot    : info.plot || '',
    cast    : info.cast || '',
    director: info.director || '',
    genre   : info.genre || '',
    rating  : info.rating || '',
    year    : info.releaseDate ? info.releaseDate.substring(0, 4) : '',
    vod_type: 'series',
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
        name: (s.name || '').trim(),
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
