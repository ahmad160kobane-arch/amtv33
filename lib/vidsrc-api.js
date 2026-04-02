/**
 * Content API v6 — TMDB للعرض + Consumet للبث
 * 
 * TMDB: معلومات الأفلام والمسلسلات (سريع ومستقر)
 * FlixHQ/Goku: روابط البث فقط
 */

const config = require('../config');
const { MOVIES } = require('@consumet/extensions');

const TMDB_BASE = config.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_KEY = config.TMDB_API_KEY;
const IMG_BASE = 'https://image.tmdb.org/t/p';

// Consumet providers للبث
const flixhq = new MOVIES.FlixHQ();
const goku = new MOVIES.Goku();

// ─── Cache ──────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 دقيقة

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) cache.delete(k);
    }
  }
}

// ─── Fetch Helper ───────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// ─── TMDB Helpers ───────────────────────────────────────

function tmdbUrl(path, extra = '') {
  return `${TMDB_BASE}${path}?api_key=${TMDB_KEY}&language=ar${extra}`;
}

function posterUrl(path, size = 'w500') {
  return path ? `${IMG_BASE}/${size}${path}` : '';
}

function backdropUrl(path, size = 'w1280') {
  return path ? `${IMG_BASE}/${size}${path}` : '';
}

// ─── TMDB Genre IDs ──────────────────────────────────────
const GENRE_IDS = {
  // أفلام
  'action': 28,
  'adventure': 12,
  'animation': 16,
  'comedy': 35,
  'crime': 80,
  'documentary': 99,
  'drama': 18,
  'family': 10751,
  'fantasy': 14,
  'history': 36,
  'horror': 27,
  'music': 10402,
  'mystery': 9648,
  'romance': 10749,
  'science-fiction': 878,
  'sci-fi': 878,
  'thriller': 53,
  'war': 10752,
  'western': 37,
  // مسلسلات (بعضها مختلف)
  'action-adventure': 10759,
  'kids': 10762,
  'news': 10763,
  'reality': 10764,
  'sci-fi-fantasy': 10765,
  'soap': 10766,
  'talk': 10767,
  'war-politics': 10768,
};

// ─── تحويل نتيجة TMDB إلى الشكل الموحد ────────────────

function mapTmdbItem(item, forceType) {
  const type = forceType || (item.media_type === 'tv' ? 'tv' : (item.first_air_date ? 'tv' : 'movie'));
  const isMovie = type === 'movie';
  const dateStr = isMovie ? item.release_date : item.first_air_date;
  return {
    id: `tmdb_${item.id}`,
    tmdb_id: String(item.id),
    flixhq_id: `tmdb_${item.id}`,
    title: item.title || item.name || '',
    poster: posterUrl(item.poster_path),
    backdrop: backdropUrl(item.backdrop_path),
    year: dateStr ? dateStr.substring(0, 4) : '',
    rating: item.vote_average ? item.vote_average.toFixed(1) : '',
    genres: [],
    description: item.overview || '',
    quality: 'HD',
    vod_type: isMovie ? 'movie' : 'series',
  };
}

// ═══════════════════════════════════════════════════════
// TMDB: جلب القوائم مباشرة
// ═══════════════════════════════════════════════════════

async function fetchTmdbTrending(timeWindow = 'week', page = 1) {
  const key = `tmdb_trending_${timeWindow}_${page}`;
  const cached = getCached(key);
  if (cached) return cached;

  const data = await fetchJson(tmdbUrl(`/trending/all/${timeWindow}`, `&page=${page}&region=SA`));
  const items = (data.results || []).map(i => mapTmdbItem(i, i.media_type === 'tv' ? 'tv' : 'movie'));
  setCache(key, items);
  return items;
}

async function fetchTmdbPopularMovies(page = 1) {
  const key = `tmdb_pop_movies_${page}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchJson(tmdbUrl('/movie/popular', `&page=${page}&region=SA`));
  const items = (data.results || []).map(i => mapTmdbItem(i, 'movie'));
  setCache(key, items);
  return items;
}

async function fetchTmdbPopularTv(page = 1) {
  const key = `tmdb_pop_tv_${page}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchJson(tmdbUrl('/tv/popular', `&page=${page}`));
  const items = (data.results || []).map(i => mapTmdbItem(i, 'tv'));
  setCache(key, items);
  return items;
}

async function fetchTmdbNowPlayingMovies(page = 1) {
  const key = `tmdb_now_movies_${page}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchJson(tmdbUrl('/movie/now_playing', `&page=${page}&region=SA`));
  const items = (data.results || []).map(i => mapTmdbItem(i, 'movie'));
  setCache(key, items);
  return items;
}

async function fetchTmdbAiringTv(page = 1) {
  const key = `tmdb_airing_tv_${page}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchJson(tmdbUrl('/tv/airing_today', `&page=${page}`));
  const items = (data.results || []).map(i => mapTmdbItem(i, 'tv'));
  setCache(key, items);
  return items;
}

// ─── Discover بالتصنيف ──────────────────────────────────
async function fetchTmdbDiscoverMovies(genreId, page = 1) {
  const key = `tmdb_discover_movie_${genreId}_${page}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchJson(tmdbUrl('/discover/movie', `&page=${page}&sort_by=popularity.desc&with_genres=${genreId}&vote_count.gte=100`));
  const items = (data.results || []).map(i => mapTmdbItem(i, 'movie'));
  setCache(key, items);
  return items;
}

async function fetchTmdbDiscoverTv(genreId, page = 1) {
  const key = `tmdb_discover_tv_${genreId}_${page}`;
  const cached = getCached(key);
  if (cached) return cached;
  const data = await fetchJson(tmdbUrl('/discover/tv', `&page=${page}&sort_by=popularity.desc&with_genres=${genreId}&vote_count.gte=50`));
  const items = (data.results || []).map(i => mapTmdbItem(i, 'tv'));
  setCache(key, items);
  return items;
}

// ─── البحث في TMDB ──────────────────────────────────────

async function searchTmdb(query, page = 1) {
  if (!query || query.length < 2) return { items: [], page: 1, hasMore: false };
  const key = `tmdb_search_${query}_${page}`;
  const cached = getCached(key);
  if (cached) return cached;

  const data = await fetchJson(tmdbUrl('/search/multi', `&query=${encodeURIComponent(query)}&page=${page}&include_adult=false`));
  const items = (data.results || [])
    .filter(i => i.media_type === 'movie' || i.media_type === 'tv')
    .map(i => mapTmdbItem(i));

  const result = {
    items,
    page: data.page || page,
    hasMore: (data.page || 1) < (data.total_pages || 1),
  };
  setCache(key, result);
  return result;
}

// ─── تفاصيل + حلقات من TMDB ────────────────────────────────────

async function fetchTmdbMeta(tmdbId, type = 'movie') {
  const tmdbType = (type === 'tv' || type === 'series') ? 'tv' : 'movie';
  const key = `tmdb_meta_${tmdbType}_${tmdbId}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    // جلب البيانات بالعربية للعرض
    const data = await fetchJson(tmdbUrl(`/${tmdbType}/${tmdbId}`, '&append_to_response=credits,external_ids'));
    if (!data || data.success === false) return null;

    // جلب العنوان الإنجليزي الأصلي للبحث في FlixHQ
    const dataEn = await fetchJson(`${TMDB_BASE}/${tmdbType}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`);
    const originalTitle = dataEn.title || dataEn.name || data.original_title || data.original_name || '';

    const genres = (data.genres || []).map(g => g.name);
    const cast = (data.credits?.cast || []).slice(0, 10).map(c => c.name).join(', ');
    const directors = (data.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name).join(', ');
    const countries = (data.production_countries || []).map(c => c.name).join(', ');

    const result = {
      tmdb_id: String(data.id),
      flixhq_id: `tmdb_${data.id}`,
      name: data.title || data.name || '',
      original_title: originalTitle, // العنوان الإنجليزي للبحث
      poster: posterUrl(data.poster_path),
      background: backdropUrl(data.backdrop_path),
      description: data.overview || '',
      year: (data.release_date || data.first_air_date || '').substring(0, 4),
      genres,
      runtime: data.runtime ? `${data.runtime} د` : (data.episode_run_time?.[0] ? `${data.episode_run_time[0]} د` : ''),
      cast,
      director: directors,
      country: countries,
      rating: data.vote_average ? data.vote_average.toFixed(1) : '',
      seasons_count: data.number_of_seasons || 0,
      episodes_count: data.number_of_episodes || 0,
    };

    setCache(key, result);
    return result;
  } catch (e) {
    console.error(`[TMDB] خطأ ${tmdbId}:`, e.message);
    return null;
  }
}

async function fetchTmdbSeasonEpisodes(tmdbId, totalSeasons) {
  if (!tmdbId || !totalSeasons) return { seasons: [], episodes: [] };
  const key = `tmdb_eps_${tmdbId}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const seasons = [];
    const episodes = [];

    const seasonNums = Array.from({ length: totalSeasons }, (_, i) => i + 1);
    const batchSize = 5;
    for (let i = 0; i < seasonNums.length; i += batchSize) {
      const batch = seasonNums.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(s => fetchJson(tmdbUrl(`/tv/${tmdbId}/season/${s}`)).catch(() => null))
      );
      for (const sData of results) {
        if (!sData || !sData.episodes) continue;
        const sNum = sData.season_number;
        if (sNum > 0) seasons.push(sNum);
        for (const ep of sData.episodes) {
          episodes.push({
            id: `${tmdbId}:${sNum}:${ep.episode_number}`,
            season: sNum,
            episode: ep.episode_number,
            title: ep.name || `الحلقة ${ep.episode_number}`,
            overview: ep.overview || '',
            thumbnail: posterUrl(ep.still_path, 'w300'),
            released: ep.air_date || '',
          });
        }
      }
    }

    seasons.sort((a, b) => a - b);
    const result = { seasons, episodes };
    setCache(key, result);
    return result;
  } catch (e) {
    console.error(`[TMDB] خطأ حلقات ${tmdbId}:`, e.message);
    return { seasons: [], episodes: [] };
  }
}

// ═══════════════════════════════════════════════════════
// API العام
// ═══════════════════════════════════════════════════════

/**
 * الصفحة الرئيسية — من TMDB
 */
async function getHome() {
  const key = 'home_data_v6';
  const cached = getCached(key);
  if (cached) return cached;

  const [trending, popularMovies, popularTv, nowPlaying, airingTv] = await Promise.all([
    fetchTmdbTrending('week', 1),
    fetchTmdbPopularMovies(1),
    fetchTmdbPopularTv(1),
    fetchTmdbNowPlayingMovies(1),
    fetchTmdbAiringTv(1),
  ]);

  const result = {
    trending: trending.slice(0, 15),
    latestMovies: nowPlaying.slice(0, 15),
    latestTvShows: airingTv.slice(0, 15),
    popularMovies: popularMovies.slice(0, 15),
    popularTvShows: popularTv.slice(0, 15),
  };
  setCache(key, result);
  return result;
}

/**
 * تصفح المحتوى — من TMDB مع دعم التصنيفات
 */
async function browse({ type = 'all', page = 1, category = 'popular' } = {}) {
  let items = [];

  // التحقق إذا كان التصنيف هو genre
  const genreId = GENRE_IDS[category.toLowerCase()];

  if (category === 'trending') {
    items = await fetchTmdbTrending('week', page);
    if (type === 'movie') items = items.filter(i => i.vod_type === 'movie');
    if (type === 'tv' || type === 'series') items = items.filter(i => i.vod_type === 'series');
  } else if (genreId) {
    // استخدام discover API للتصفية حسب التصنيف
    if (type === 'movie') {
      items = await fetchTmdbDiscoverMovies(genreId, page);
    } else if (type === 'tv' || type === 'series') {
      items = await fetchTmdbDiscoverTv(genreId, page);
    } else {
      // جلب كلاهما
      const [movies, tv] = await Promise.all([
        fetchTmdbDiscoverMovies(genreId, page),
        fetchTmdbDiscoverTv(genreId, page),
      ]);
      items = [...movies, ...tv].sort(() => Math.random() - 0.5);
    }
  } else if (type === 'movie') {
    if (category === 'now_playing') items = await fetchTmdbNowPlayingMovies(page);
    else items = await fetchTmdbPopularMovies(page);
  } else if (type === 'tv' || type === 'series') {
    if (category === 'airing') items = await fetchTmdbAiringTv(page);
    else items = await fetchTmdbPopularTv(page);
  } else {
    const [movies, tv] = await Promise.all([
      fetchTmdbPopularMovies(page),
      fetchTmdbPopularTv(page),
    ]);
    items = [...movies, ...tv].sort(() => Math.random() - 0.5);
  }

  return {
    items,
    page,
    hasMore: items.length >= 15,
  };
}

/**
 * بحث — من TMDB
 */
async function search(query, page = 1) {
  return searchTmdb(query, page);
}

/**
 * تفاصيل عنصر واحد — من TMDB
 */
async function getDetail(tmdbId, type = 'movie') {
  const meta = await fetchTmdbMeta(tmdbId, type);
  if (!meta) return null;

  const tmdbType = (type === 'tv' || type === 'series') ? 'series' : 'movie';
  const result = {
    id: `tmdb_${meta.tmdb_id}`,
    tmdb_id: meta.tmdb_id,
    flixhq_id: meta.flixhq_id,
    title: meta.name,
    original_title: meta.original_title, // العنوان الإنجليزي للبحث
    poster: meta.poster,
    backdrop: meta.background,
    description: meta.description,
    year: meta.year,
    rating: meta.rating,
    genres: meta.genres,
    genre: meta.genres.join(', '),
    cast: meta.cast,
    director: meta.director,
    country: meta.country,
    runtime: meta.runtime,
    vod_type: tmdbType === 'series' ? 'series' : 'movie',
  };

  if (tmdbType === 'series' && meta.seasons_count > 0) {
    const epData = await fetchTmdbSeasonEpisodes(meta.tmdb_id, meta.seasons_count);
    result.seasons = epData.seasons;
    result.episodes = epData.episodes;
  }

  return result;
}

/**
 * أحدث الحلقات — من TMDB
 */
async function getLatestEpisodes(page = 1) {
  return fetchTmdbAiringTv(page);
}

module.exports = {
  getHome,
  browse,
  search,
  getDetail,
  getLatestEpisodes,
};
