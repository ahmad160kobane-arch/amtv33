const express = require('express');
const db = require('../db');
const pool = db.pool;

const router = express.Router();

// GET /api/lulu/home — أحدث الأفلام والمسلسلات
router.get('/home', async (req, res) => {
  try {
    const movies = await pool.query(
      `SELECT id, title, poster, year, rating, genres as genre, vod_type, canplay
       FROM lulu_catalog WHERE vod_type = 'movie' AND canplay = true
       ORDER BY uploaded_at DESC NULLS LAST LIMIT 24`
    );
    const series = await pool.query(
      `SELECT id, title, poster, year, rating, genres as genre, vod_type, episode_count
       FROM lulu_catalog WHERE vod_type = 'series' AND canplay = true
       ORDER BY uploaded_at DESC NULLS LAST LIMIT 24`
    );
    res.json({
      latestMovies: movies.rows.map(r => ({
        id: r.id, title: r.title, poster: r.poster || '',
        year: r.year || '', genre: r.genre || '', rating: r.rating || '',
        lang: '', vod_type: 'movie',
      })),
      latestSeries: series.rows.map(r => ({
        id: r.id, title: r.title, poster: r.poster || '',
        year: r.year || '', genre: r.genre || '', rating: r.rating || '',
        lang: '', vod_type: 'series', episodeCount: r.episode_count || 0,
      })),
    });
  } catch (e) {
    console.error('[Lulu] home error:', e.message);
    res.status(500).json({ error: 'فشل جلب الكاتالوج' });
  }
});

// GET /api/lulu/list?type=movie|series&page=1&search=&genre=
router.get('/list', async (req, res) => {
  try {
    const { type = 'movie', page = '1', search = '', genre = '' } = req.query;
    const pg = Math.max(1, parseInt(page));
    const limit = 24;
    const offset = (pg - 1) * limit;
    const q = String(search).toLowerCase();

    let where = ["vod_type = $1", "canplay = true"];
    let params = [type];
    let pi = 2;

    if (q) { where.push(`LOWER(title) LIKE $${pi}`); params.push(`%${q}%`); pi++; }
    if (genre) { where.push(`genres ILIKE $${pi}`); params.push(`%${genre}%`); pi++; }

    const whereStr = 'WHERE ' + where.join(' AND ');

    const totalRes = await pool.query(`SELECT COUNT(*) as c FROM lulu_catalog ${whereStr}`, params);
    const total = parseInt(totalRes.rows[0]?.c || 0);

    const itemsRes = await pool.query(
      `SELECT id, title, poster, year, rating, genres as genre, vod_type, episode_count
       FROM lulu_catalog ${whereStr}
       ORDER BY uploaded_at DESC NULLS LAST
       LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset]
    );

    const items = itemsRes.rows.map(r => ({
      id: r.id, title: r.title, poster: r.poster || '',
      year: r.year || '', genre: r.genre || '', rating: r.rating || '',
      lang: '', vod_type: r.vod_type,
      episodeCount: r.vod_type === 'series' ? (r.episode_count || 0) : undefined,
    }));

    res.json({ items, page: pg, total, hasMore: offset + limit < total });
  } catch (e) {
    console.error('[Lulu] list error:', e.message);
    res.status(500).json({ error: 'فشل جلب القائمة' });
  }
});

// GET /api/lulu/detail?type=movie|series&id=xxx
router.get('/detail', async (req, res) => {
  try {
    const { type, id } = req.query;
    if (!id) return res.status(400).json({ error: 'id مطلوب' });

    const catRes = await pool.query(
      `SELECT * FROM lulu_catalog WHERE id = $1 AND vod_type = $2`,
      [id, type || 'movie']
    );
    const cat = catRes.rows[0];
    if (!cat) return res.status(404).json({ error: 'المحتوى غير موجود' });

    const base = {
      id: cat.id, title: cat.title, poster: cat.poster || '',
      backdrop: cat.backdrop || cat.poster || '',
      plot: cat.plot || '', year: cat.year || '', rating: cat.rating || '',
      genre: cat.genres || '', genres: cat.genres || '',
      lang: '', cast_list: cat.cast_list || '',
      director: cat.director || '', country: cat.country || '',
      runtime: cat.runtime || '', vod_type: cat.vod_type,
      fileCode: cat.file_code, hlsUrl: cat.hls_url, embedUrl: cat.embed_url,
      canplay: cat.canplay,
      subtitleUrls: null,
    };

    if (cat.vod_type === 'series') {
      const epsRes = await pool.query(
        `SELECT * FROM lulu_episodes WHERE catalog_id = $1 ORDER BY season, episode`,
        [cat.id]
      );
      const seasonMap = {};
      for (const ep of epsRes.rows) {
        const s = String(ep.season || 1);
        if (!seasonMap[s]) seasonMap[s] = [];
        seasonMap[s].push({
          id: String(ep.id),
          episode: ep.episode,
          season: ep.season,
          title: ep.title || `الحلقة ${ep.episode}`,
          fileCode: ep.file_code,
          hlsUrl: ep.hls_url,
          embedUrl: ep.embed_url,
          canplay: ep.canplay,
          thumbnail: ep.thumbnail || '',
          overview: ep.overview || '',
          air_date: ep.air_date || '',
          ext: 'mp4',
        });
      }
      const seasons = Object.entries(seasonMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([s, eps]) => ({ season: Number(s), episodes: eps }));

      base.seasons = seasons;
      base.episodes = seasons.flatMap(s => s.episodes);
    }

    res.json(base);
  } catch (e) {
    console.error('[Lulu] detail error:', e.message);
    res.status(500).json({ error: 'فشل جلب التفاصيل' });
  }
});

// GET /api/lulu/stream?type=movie|series&id=xxx&ep_id=xxx
router.get('/stream', async (req, res) => {
  try {
    const { type, id, ep_id } = req.query;

    if (type === 'movie' && id) {
      const r = await pool.query(
        `SELECT file_code, hls_url, embed_url, canplay, title FROM lulu_catalog WHERE id = $1`,
        [id]
      );
      const row = r.rows[0];
      if (!row || !row.canplay) return res.json({ available: false, reason: 'encoding' });
      return res.json({
        available: true, fileCode: row.file_code,
        hlsUrl: row.hls_url, embedUrl: row.embed_url, title: row.title,
      });
    }

    if ((type === 'series') && ep_id) {
      const r = await pool.query(
        `SELECT file_code, hls_url, embed_url, canplay, title FROM lulu_episodes WHERE id = $1`,
        [ep_id]
      );
      const row = r.rows[0];
      if (!row || !row.canplay) return res.json({ available: false, reason: 'encoding' });
      return res.json({
        available: true, fileCode: row.file_code,
        hlsUrl: row.hls_url, embedUrl: row.embed_url, title: row.title,
      });
    }

    res.status(400).json({ error: 'معاملات غير صحيحة' });
  } catch (e) {
    console.error('[Lulu] stream error:', e.message);
    res.status(500).json({ error: 'فشل جلب رابط البث' });
  }
});

// GET /api/lulu/genres — قائمة التصنيفات المتاحة
router.get('/genres', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT DISTINCT unnest(string_to_array(genres, '،')) as genre FROM lulu_catalog WHERE genres != '' ORDER BY genre`
    );
    res.json({ genres: r.rows.map(row => row.genre.trim()).filter(Boolean) });
  } catch (e) {
    console.error('[Lulu] genres error:', e.message);
    res.status(500).json({ error: 'فشل جلب التصنيفات' });
  }
});

module.exports = router;
