// أضف هذا الكود في cloud-server/server.js بعد السطر 2350

const VidSrcApiClient = require('./lib/vidsrc-api-client');

// ═══ VidSrc API - استخراج فيديو + ترجمات ═══
app.post('/api/stream/vidsrc-full', requireAuth, requirePremium, async (req, res) => {
  const { tmdbId, type = 'movie', season, episode } = req.body;

  if (!tmdbId) {
    return res.status(400).json({ error: 'tmdbId مطلوب' });
  }

  try {
    const client = new VidSrcApiClient();
    const result = await client.getStream(tmdbId, type, season, episode);

    if (result.success) {
      // تسجيل في السجل
      try {
        const { randomUUID } = require('crypto');
        await db.prepare('INSERT INTO watch_history (id, user_id, item_id, item_type) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
          .run(randomUUID(), req.user.id, tmdbId, 'vod');
      } catch (_) {}

      return res.json({
        success: true,
        hlsUrl: result.streamUrl,
        streamUrl: result.streamUrl,
        subtitles: result.subtitles,
        provider: 'vidsrc-full',
        ready: true
      });
    }

    return res.status(404).json({
      success: false,
      error: result.error || 'لا توجد مصادر بث متاحة'
    });

  } catch (error) {
    console.error('[VidSrc Full] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
