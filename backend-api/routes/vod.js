const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

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
