'use strict';

/**
 * db.js — حفظ الكتالوج في PostgreSQL
 * يُستدعى من uploader.js بعد كل رفع ناجح
 */

const { Pool } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:ItqaSByVVVKDVlOEPvTNSrqsOVecsIGu@switchback.proxy.rlwy.net:23361/railway';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('[DB] Pool error:', err.message));

// ─── إنشاء الجداول إذا لم تكن موجودة ──────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lulu_catalog (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL DEFAULT '',
      vod_type      TEXT NOT NULL DEFAULT 'movie',
      poster        TEXT DEFAULT '',
      backdrop      TEXT DEFAULT '',
      plot          TEXT DEFAULT '',
      year          TEXT DEFAULT '',
      rating        TEXT DEFAULT '',
      genres        TEXT DEFAULT '',
      cast_list     TEXT DEFAULT '',
      director      TEXT DEFAULT '',
      country       TEXT DEFAULT '',
      runtime       TEXT DEFAULT '',
      tmdb_id       INTEGER,
      tmdb_type     TEXT DEFAULT '',
      imdb_id       TEXT DEFAULT '',
      file_code     TEXT DEFAULT '',
      embed_url     TEXT DEFAULT '',
      hls_url       TEXT DEFAULT '',
      canplay       BOOLEAN DEFAULT false,
      episode_count INTEGER DEFAULT 0,
      lulu_fld_id   INTEGER DEFAULT 0,
      uploaded_at   BIGINT DEFAULT 0,
      updated_at    BIGINT DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_lulu_catalog_type     ON lulu_catalog(vod_type);
    CREATE INDEX IF NOT EXISTS idx_lulu_catalog_uploaded ON lulu_catalog(uploaded_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lulu_episodes (
      id          SERIAL PRIMARY KEY,
      catalog_id  TEXT NOT NULL,
      season      INTEGER NOT NULL DEFAULT 1,
      episode     INTEGER NOT NULL,
      title       TEXT DEFAULT '',
      file_code   TEXT NOT NULL,
      embed_url   TEXT DEFAULT '',
      hls_url     TEXT DEFAULT '',
      canplay     BOOLEAN DEFAULT false,
      thumbnail   TEXT DEFAULT '',
      overview    TEXT DEFAULT '',
      air_date    TEXT DEFAULT '',
      duration    INTEGER DEFAULT 0,
      created_at  BIGINT DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_lulu_episodes_catalog ON lulu_episodes(catalog_id, season, episode);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lulu_ep_unique ON lulu_episodes(catalog_id, season, episode);
  `);
}

// ─── حفظ فيلم في الكتالوج ──────────────────────────────────────
/**
 * @param {object} data
 * data.id         — fileCode (معرف الفيلم)
 * data.title      — عنوان الفيلم
 * data.fileCode   — LuluStream file code
 * data.embedUrl   — رابط embed
 * data.hlsUrl     — رابط HLS
 * data.canplay    — هل جاهز للتشغيل
 * data.fldId      — معرف المجلد في LuluStream
 * data.poster     — رابط الصورة (TMDB)
 * data.backdrop   — خلفية (TMDB)
 * data.overview   — القصة
 * data.year       — سنة الإصدار
 * data.cast       — الممثلون (comma-separated)
 * data.genres     — التصنيفات
 * data.tmdbId     — معرف TMDB
 */
async function saveMovieToCatalog(data) {
  const now = Date.now();
  await pool.query(`
    INSERT INTO lulu_catalog
      (id, title, vod_type, poster, backdrop, plot, year, rating, genres, cast_list,
       director, country, runtime, tmdb_id, tmdb_type, imdb_id,
       file_code, embed_url, hls_url, canplay, episode_count, lulu_fld_id,
       uploaded_at, updated_at)
    VALUES ($1,$2,'movie',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'movie',$14,$15,$16,$17,$18,0,$19,$20,$20)
    ON CONFLICT (id) DO UPDATE SET
      title        = EXCLUDED.title,
      poster       = EXCLUDED.poster,
      backdrop     = EXCLUDED.backdrop,
      plot         = EXCLUDED.plot,
      year         = EXCLUDED.year,
      rating       = EXCLUDED.rating,
      genres       = EXCLUDED.genres,
      cast_list    = EXCLUDED.cast_list,
      director     = EXCLUDED.director,
      country      = EXCLUDED.country,
      runtime      = EXCLUDED.runtime,
      tmdb_id      = EXCLUDED.tmdb_id,
      imdb_id      = EXCLUDED.imdb_id,
      file_code    = EXCLUDED.file_code,
      embed_url    = EXCLUDED.embed_url,
      hls_url      = EXCLUDED.hls_url,
      canplay      = EXCLUDED.canplay,
      lulu_fld_id  = EXCLUDED.lulu_fld_id,
      updated_at   = EXCLUDED.updated_at
  `, [
    data.id,
    data.title       || '',
    data.poster      || data.posterUrl   || '',
    data.backdrop    || data.backdropUrl || '',
    data.overview    || '',
    data.year        || '',
    data.rating      || '',
    data.genres      || '',
    data.cast        || '',
    data.director    || '',
    data.country     || '',
    data.runtime     || '',
    data.tmdbId      || null,
    data.imdbId      || '',
    data.fileCode    || '',
    data.embedUrl    || `https://luluvdo.com/e/${data.fileCode}`,
    data.hlsUrl      || `https://luluvdo.com/hls/${data.fileCode}/master.m3u8`,
    data.canplay     ?? false,
    data.fldId       || 0,
    now,
  ]);
}

// ─── حفظ حلقة مسلسل + تحديث الكتالوج ─────────────────────────
/**
 * @param {object} seriesData — بيانات المسلسل (تُخزَّن في lulu_catalog)
 * @param {object} episodeData — بيانات الحلقة (تُخزَّن في lulu_episodes)
 */
async function saveSeriesEpisode(seriesData, episodeData) {
  const now = Date.now();

  // 1. Upsert المسلسل في lulu_catalog
  await pool.query(`
    INSERT INTO lulu_catalog
      (id, title, vod_type, poster, backdrop, plot, year, rating, genres, cast_list,
       director, country, runtime, tmdb_id, tmdb_type, imdb_id,
       file_code, embed_url, hls_url, canplay, episode_count, lulu_fld_id,
       uploaded_at, updated_at)
    VALUES ($1,$2,'series',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'tv',$14,$15,$16,$17,$18,0,$19,$20,$20)
    ON CONFLICT (id) DO UPDATE SET
      title        = EXCLUDED.title,
      poster       = EXCLUDED.poster,
      backdrop     = EXCLUDED.backdrop,
      plot         = EXCLUDED.plot,
      year         = EXCLUDED.year,
      genres       = EXCLUDED.genres,
      cast_list    = EXCLUDED.cast_list,
      director     = EXCLUDED.director,
      tmdb_id      = EXCLUDED.tmdb_id,
      imdb_id      = EXCLUDED.imdb_id,
      lulu_fld_id  = EXCLUDED.lulu_fld_id,
      updated_at   = EXCLUDED.updated_at
  `, [
    seriesData.id,
    seriesData.showTitle     || seriesData.title || '',
    seriesData.poster        || seriesData.posterUrl   || '',
    seriesData.backdrop      || seriesData.backdropUrl || '',
    seriesData.overview      || '',
    seriesData.year          || '',
    seriesData.rating        || '',
    seriesData.genres        || '',
    seriesData.cast          || '',
    seriesData.director      || '',
    seriesData.country       || '',
    seriesData.runtime       || '',
    seriesData.tmdbId        || null,
    seriesData.imdbId        || '',
    episodeData.fileCode     || '',   // first/latest episode file code
    `https://luluvdo.com/e/${episodeData.fileCode}`,
    `https://luluvdo.com/hls/${episodeData.fileCode}/master.m3u8`,
    episodeData.canplay      ?? false,
    seriesData.fldId         || 0,
    now,
  ]);

  // 2. Insert/update الحلقة
  await pool.query(`
    INSERT INTO lulu_episodes
      (catalog_id, season, episode, title, file_code, embed_url, hls_url,
       canplay, thumbnail, overview, air_date, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (catalog_id, season, episode) DO UPDATE SET
      title     = EXCLUDED.title,
      file_code = EXCLUDED.file_code,
      embed_url = EXCLUDED.embed_url,
      hls_url   = EXCLUDED.hls_url,
      canplay   = EXCLUDED.canplay,
      thumbnail = EXCLUDED.thumbnail,
      overview  = EXCLUDED.overview
  `, [
    seriesData.id,
    episodeData.season       || 1,
    episodeData.episode      || 1,
    episodeData.title        || `الحلقة ${episodeData.episode}`,
    episodeData.fileCode,
    `https://luluvdo.com/e/${episodeData.fileCode}`,
    `https://luluvdo.com/hls/${episodeData.fileCode}/master.m3u8`,
    episodeData.canplay      ?? false,
    episodeData.thumbnail    || seriesData.poster || seriesData.posterUrl || '',
    episodeData.overview     || seriesData.overview || '',
    episodeData.airDate      || '',
    now,
  ]);

  // 3. تحديث عدد الحلقات
  await pool.query(`
    UPDATE lulu_catalog
    SET episode_count = (
      SELECT COUNT(*) FROM lulu_episodes WHERE catalog_id = $1
    ), updated_at = $2
    WHERE id = $1
  `, [seriesData.id, now]);
}

// ─── الحصول على جميع حلقات مسلسل ─────────────────────────────
/**
 * @param {string} seriesId — معرف المسلسل (catalog_id)
 * @returns {Promise<Array>} — قائمة الحلقات مرتبة حسب الموسم والحلقة
 */
async function getSeriesEpisodes(seriesId) {
  const result = await pool.query(`
    SELECT 
      id, catalog_id, season, episode, title,
      file_code, embed_url, hls_url, canplay,
      thumbnail, overview, air_date, created_at
    FROM lulu_episodes
    WHERE catalog_id = $1
    ORDER BY season ASC, episode ASC
  `, [seriesId]);
  
  return result.rows;
}

// ─── الحصول على حلقات موسم محدد ──────────────────────────────
/**
 * @param {string} seriesId — معرف المسلسل
 * @param {number} season — رقم الموسم
 * @returns {Promise<Array>} — قائمة حلقات الموسم
 */
async function getSeasonEpisodes(seriesId, season) {
  const result = await pool.query(`
    SELECT 
      id, catalog_id, season, episode, title,
      file_code, embed_url, hls_url, canplay,
      thumbnail, overview, air_date, created_at
    FROM lulu_episodes
    WHERE catalog_id = $1 AND season = $2
    ORDER BY episode ASC
  `, [seriesId, season]);
  
  return result.rows;
}

// ─── الحصول على حلقة محددة ────────────────────────────────────
/**
 * @param {string} seriesId — معرف المسلسل
 * @param {number} season — رقم الموسم
 * @param {number} episode — رقم الحلقة
 * @returns {Promise<object|null>} — بيانات الحلقة
 */
async function getEpisode(seriesId, season, episode) {
  const result = await pool.query(`
    SELECT 
      id, catalog_id, season, episode, title,
      file_code, embed_url, hls_url, canplay,
      thumbnail, overview, air_date, created_at
    FROM lulu_episodes
    WHERE catalog_id = $1 AND season = $2 AND episode = $3
  `, [seriesId, season, episode]);
  
  return result.rows[0] || null;
}

// ─── الحصول على معلومات المسلسل مع عدد الحلقات ─────────────
/**
 * @param {string} seriesId — معرف المسلسل
 * @returns {Promise<object|null>} — بيانات المسلسل
 */
async function getSeriesInfo(seriesId) {
  const result = await pool.query(`
    SELECT * FROM lulu_catalog
    WHERE id = $1 AND vod_type = 'series'
  `, [seriesId]);
  
  return result.rows[0] || null;
}

// ─── الحصول على جميع المواسم (مجموعة حسب الموسم) ──────────
/**
 * @param {string} seriesId — معرف المسلسل
 * @returns {Promise<Array>} — قائمة المواسم مع عدد الحلقات
 */
async function getSeriesSeasons(seriesId) {
  const result = await pool.query(`
    SELECT 
      season,
      COUNT(*) as episode_count,
      MIN(created_at) as first_episode_date,
      MAX(created_at) as last_episode_date
    FROM lulu_episodes
    WHERE catalog_id = $1
    GROUP BY season
    ORDER BY season ASC
  `, [seriesId]);
  
  return result.rows;
}

async function close() {
  await pool.end();
}

module.exports = { 
  ensureTables, 
  saveMovieToCatalog, 
  saveSeriesEpisode, 
  getSeriesEpisodes,
  getSeasonEpisodes,
  getEpisode,
  getSeriesInfo,
  getSeriesSeasons,
  close 
};
