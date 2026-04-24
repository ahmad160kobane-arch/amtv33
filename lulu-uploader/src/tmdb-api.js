'use strict';

const axios = require('axios');

const KEY  = 'e25ac5a68fba3713e572198a050697ca';
const BASE = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p/w500';

const http = axios.create({ timeout: 10000 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tmdbGet(path, params = {}) {
  return http.get(`${BASE}${path}`, { params: { api_key: KEY, language: 'ar', ...params } })
    .then(r => r.data);
}

function posterUrl(path) {
  return path ? `${IMG}${path}` : null;
}

function buildDescription({ overview, cast, genres, year, type }) {
  const lines = [];
  if (overview) lines.push(overview);
  if (cast)     lines.push(`\nطاقم التمثيل: ${cast}`);
  if (genres)   lines.push(`التصنيف: ${genres}`);
  if (year)     lines.push(`سنة ${type === 'movie' ? 'الإصدار' : 'البدء'}: ${year}`);
  return lines.join('\n');
}

function extractCast(credits, limit = 8) {
  return (credits?.cast || []).slice(0, limit).map(a => a.name).join('، ');
}

function extractGenres(genres) {
  return (genres || []).map(g => g.name).join('، ');
}

// ─── Movie ────────────────────────────────────────────────────────────────────

async function getMovieDetails(tmdbId) {
  const data = await tmdbGet(`/movie/${tmdbId}`, { append_to_response: 'credits' });

  const cast   = extractCast(data.credits);
  const genres = extractGenres(data.genres);
  const year   = data.release_date?.split('-')[0];

  return {
    type:        'movie',
    tmdbId:      data.id,
    imdbId:      data.imdb_id || '',
    title:       data.title || data.original_title,
    overview:    data.overview || '',
    posterUrl:   posterUrl(data.poster_path),
    backdropUrl: posterUrl(data.backdrop_path),
    year,
    cast,
    genres,
    director:    (data.credits?.crew || []).find(c => c.job === 'Director')?.name || '',
    country:     (data.production_countries || []).map(c => c.name).join(', '),
    runtime:     data.runtime ? `${data.runtime} دقيقة` : '',
    rating:      data.vote_average ? String(data.vote_average.toFixed(1)) : '',
    tags:        genres,
    description: buildDescription({ overview: data.overview, cast, genres, year, type: 'movie' }),
  };
}

// ─── TV Series ────────────────────────────────────────────────────────────────

async function getTvDetails(tmdbId, season, episode) {
  const show = await tmdbGet(`/tv/${tmdbId}`, { append_to_response: 'credits' });

  let epData = null;
  if (season != null && episode != null) {
    try {
      epData = await tmdbGet(`/tv/${tmdbId}/season/${season}/episode/${episode}`);
    } catch (_) { /* episode data optional */ }
  }

  const cast      = extractCast(show.credits);
  const genres    = extractGenres(show.genres);
  const year      = show.first_air_date?.split('-')[0];
  const showTitle = show.name || show.original_name;
  const overview  = epData?.overview || show.overview || '';

  const s = String(season  || 1).padStart(2, '0');
  const e = String(episode || 1).padStart(2, '0');

  return {
    type:        'tv',
    tmdbId:      show.id,
    imdbId:      show.external_ids?.imdb_id || '',
    showTitle,
    title:       `${showTitle} S${s}E${e}`,
    overview,
    posterUrl:   posterUrl(show.poster_path),
    backdropUrl: posterUrl(show.backdrop_path),
    year,
    cast,
    genres,
    rating:      show.vote_average ? String(show.vote_average.toFixed(1)) : '',
    country:     (show.production_countries || show.origin_country || []).join ? (show.origin_country || []).join(', ') : '',
    tags:        genres,
    description: buildDescription({ overview, cast, genres, year, type: 'tv' }),
    season,
    episode,
    epOverview:  epData?.overview || '',
    epAirDate:   epData?.air_date || '',
  };
}

// ─── Search wrappers ──────────────────────────────────────────────────────────

async function searchAndGetMovie(title) {
  const data = await tmdbGet('/search/movie', { query: title });
  const hit  = data.results?.[0];
  if (!hit) throw new Error(`لم يتم العثور على فيلم بعنوان: "${title}"`);
  return getMovieDetails(hit.id);
}

async function searchAndGetTv(title, season, episode) {
  const data = await tmdbGet('/search/tv', { query: title });
  const hit  = data.results?.[0];
  if (!hit) throw new Error(`لم يتم العثور على مسلسل بعنوان: "${title}"`);
  return getTvDetails(hit.id, season, episode);
}

module.exports = {
  getMovieDetails,
  getTvDetails,
  searchAndGetMovie,
  searchAndGetTv,
};
