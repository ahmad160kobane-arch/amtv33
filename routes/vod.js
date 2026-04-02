const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requirePremium, JWT_SECRET } = require('../middleware/auth');
const consumet = require('../lib/consumet');

const router = express.Router();

// GET /api/vod/all - List VOD items with pagination (من Consumet/TMDB)
router.get('/all', async (req, res) => {
  try {
    const { type, category, search, limit, offset } = req.query;
    
    let items = [];
    
    // إذا كان هناك بحث
    if (search) {
      const searchType = type === 'movie' ? 'movie' : type === 'series' ? 'tv' : 'multi';
      items = await consumet.searchContent(search, searchType);
    } else {
      // جلب المحتوى الشائع
      if (type === 'movie' || !type || type === 'all') {
        const movies = await consumet.fetchPopularMovies(1);
        items = items.concat(movies);
      }
      if (type === 'series' || !type || type === 'all') {
        const series = await consumet.fetchPopularSeries(1);
        items = items.concat(series);
      }
    }
    
    // تصفية حسب الفئة إذا لزم الأمر
    if (category && category !== 'all') {
      items = items.filter(item => item.category === category);
    }
    
    const total = items.length;
    const pLimit = parseInt(limit) || 20;
    const pOffset = parseInt(offset) || 0;
    
    const paginatedItems = items.slice(pOffset, pOffset + pLimit);
    
    res.json({ 
      items: paginatedItems, 
      total, 
      limit: pLimit, 
      offset: pOffset, 
      hasMore: pOffset + pLimit < total 
    });
  } catch (err) {
    console.error('VOD list error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vod/categories - List all categories
router.get('/categories', async (req, res) => {
  res.json({ 
    categories: ['أفلام', 'مسلسلات', 'أطفال', 'وثائقي', 'أنمي'] 
  });
});

// GET /api/vod/:id - Get single VOD with episodes (من FlixHQ مباشرة)
router.get('/:id', async (req, res) => {
  try {
    // استخراج FlixHQ ID من المعرف
    const match = req.params.id.match(/^flixhq_(movie|series)_(.+)$/);
    if (!match) {
      return res.status(404).json({ error: 'المحتوى غير موجود' });
    }
    
    const [, type, flixhqId] = match;
    
    let item;
    if (type === 'movie') {
      item = await consumet.fetchMovieDetails(flixhqId);
      if (item) {
        item.id = req.params.id;
        item.flixhq_id = flixhqId;
        item.vod_type = 'movie';
        // سيتم جلب رابط البث عند الطلب من /play
        item.token = `movie_${flixhqId}`;
      }
    } else {
      item = await consumet.fetchSeriesDetails(flixhqId);
      if (item) {
        item.id = req.params.id;
        item.flixhq_id = flixhqId;
        item.vod_type = 'series';
        
        // جلب الحلقات لكل موسم
        item.episodes = [];
        for (const season of item.seasons) {
          if (season.season_number === 0) continue; // تخطي الحلقات الخاصة
          const episodes = await consumet.fetchSeasonEpisodes(flixhqId, season.season_number);
          for (const ep of episodes) {
            item.episodes.push({
              id: `flixhq_ep_${flixhqId}_${season.season_number}_${ep.episode_num}`,
              title: ep.title,
              season: season.season_number,
              episode: ep.episode_num,
              token: `series_${flixhqId}_${season.season_number}_${ep.episode_num}`,
              duration: ep.duration,
              duration_secs: ep.duration_secs,
              air_date: ep.air_date,
              description: ep.description,
              flixhq_episode_id: ep.flixhq_episode_id,
            });
          }
        }
      }
    }
    
    if (!item) {
      return res.status(404).json({ error: 'المحتوى غير موجود' });
    }
    
    res.json(item);
  } catch (err) {
    console.error('VOD detail error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vod/:id/episodes - Get episodes for a series
router.get('/:id/episodes', async (req, res) => {
  try {
    const match = req.params.id.match(/^flixhq_series_(.+)$/);
    if (!match) {
      return res.status(404).json({ error: 'المسلسل غير موجود' });
    }
    
    const flixhqId = match[1];
    const details = await consumet.fetchSeriesDetails(flixhqId);
    
    if (!details) {
      return res.status(404).json({ error: 'المسلسل غير موجود' });
    }
    
    const episodes = [];
    for (const season of details.seasons) {
      if (season.season_number === 0) continue;
      const seasonEps = await consumet.fetchSeasonEpisodes(flixhqId, season.season_number);
      for (const ep of seasonEps) {
        episodes.push({
          id: `flixhq_ep_${flixhqId}_${season.season_number}_${ep.episode_num}`,
          title: ep.title,
          season: season.season_number,
          episode: ep.episode_num,
          token: `series_${flixhqId}_${season.season_number}_${ep.episode_num}`,
          duration: ep.duration,
          duration_secs: ep.duration_secs,
          air_date: ep.air_date,
          flixhq_episode_id: ep.flixhq_episode_id,
        });
      }
    }
    
    res.json({ episodes });
  } catch (err) {
    console.error('Episodes error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vod/play/:token - Get play URL (روابط m3u8 مباشرة من FlixHQ)
router.get('/play/:token', requireAuth, requirePremium, async (req, res) => {
  try {
    const token = decodeURIComponent(req.params.token);
    
    // تحليل التوكن: movie_flixhqId أو series_flixhqId_season_episode
    const movieMatch = token.match(/^movie_(.+)$/);
    const seriesMatch = token.match(/^series_(.+)_(\d+)_(\d+)$/);
    
    let streamData;
    
    if (movieMatch) {
      const flixhqId = movieMatch[1];
      streamData = await consumet.getMovieStreamUrl(flixhqId);
      
      // Log to history
      try {
        await db.prepare('INSERT INTO watch_history (id, user_id, item_id, item_type, title, poster, content_type, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())')
          .run(uuidv4(), req.user.id, `flixhq_movie_${flixhqId}`, 'vod', req.query.title || '', req.query.poster || '', 'movie');
      } catch (e) {}
      
    } else if (seriesMatch) {
      const [, flixhqId, season, episode] = seriesMatch;
      streamData = await consumet.getEpisodeStreamUrl(flixhqId, parseInt(season), parseInt(episode));
      
      // Log to history
      try {
        await db.prepare('INSERT INTO watch_history (id, user_id, item_id, item_type, title, poster, content_type, watched_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())')
          .run(uuidv4(), req.user.id, `flixhq_series_${flixhqId}`, 'vod', req.query.title || '', req.query.poster || '', 'series');
      } catch (e) {}
    }
    
    if (!streamData || !streamData.url) {
      return res.status(404).json({ error: 'رابط البث غير متاح' });
    }
    
    res.json({
      url: streamData.url,
      quality: streamData.quality,
      subtitles: streamData.subtitles,
      headers: streamData.headers,
    });
  } catch (err) {
    console.error('Play error:', err);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/vod/favorite - Toggle favorite
router.post('/favorite', requireAuth, async (req, res) => {
  const { item_id, item_type, title, poster, content_type } = req.body;
  if (!item_id || !item_type) return res.status(400).json({ error: 'item_id و item_type مطلوبان' });

  const existing = await db.prepare('SELECT id FROM favorites WHERE user_id = ? AND item_id = ? AND item_type = ?')
    .get(req.user.id, item_id, item_type);

  if (existing) {
    await db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
    res.json({ favorited: false });
  } else {
    await db.prepare('INSERT INTO favorites (id, user_id, item_id, item_type, title, poster, content_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), req.user.id, item_id, item_type, title || '', poster || '', content_type || 'movie');
    res.json({ favorited: true });
  }
});

// GET /api/vod/favorites/list - Get user favorites
router.get('/favorites/list', requireAuth, async (req, res) => {
  const favVod = await db.prepare(`
    SELECT item_id as id, item_type, title, poster, content_type, created_at
    FROM favorites WHERE user_id = ? AND item_type = 'vod'
    ORDER BY created_at DESC
  `).all(req.user.id);

  const favChannels = await db.prepare(`
    SELECT c.id, c.name, c.group_name as "group", c.logo_url as logo
    FROM favorites f JOIN channels c ON f.item_id = c.id WHERE f.user_id = ? AND f.item_type = 'channel'
    ORDER BY f.created_at DESC
  `).all(req.user.id);

  res.json({ vod: favVod, channels: favChannels });
});

// POST /api/vod/rate - Submit or update a rating (1-5, once per user per vod)
router.post('/rate', requireAuth, async (req, res) => {
  const { vod_id, score } = req.body;
  if (!vod_id || !score) return res.status(400).json({ error: 'vod_id و score مطلوبان' });
  if (score < 1 || score > 5) return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5' });

  const existing = await db.prepare('SELECT id FROM ratings WHERE user_id = ? AND vod_id = ?')
    .get(req.user.id, vod_id);

  if (existing) {
    await db.prepare('UPDATE ratings SET score = ? WHERE id = ?').run(score, existing.id);
  } else {
    await db.prepare('INSERT INTO ratings (id, user_id, vod_id, score) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), req.user.id, vod_id, score);
  }

  const stats = await db.prepare('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE vod_id = ?').get(vod_id);
  res.json({
    success: true,
    userScore: score,
    average: Math.round((stats.avg || 0) * 10) / 10,
    count: stats.count,
  });
});

// GET /api/vod/:id/rating - Get rating info for a VOD item
router.get('/:id/rating', async (req, res) => {
  const stats = await db.prepare('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE vod_id = ?').get(req.params.id);
  const result = {
    average: Math.round((stats?.avg || 0) * 10) / 10,
    count: stats?.count || 0,
    userScore: 0,
  };

  // If auth header present, get user's rating
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const userRating = await db.prepare('SELECT score FROM ratings WHERE user_id = ? AND vod_id = ?')
        .get(decoded.userId, req.params.id);
      if (userRating) result.userScore = userRating.score;
    } catch {}
  }

  res.json(result);
});

module.exports = router;
