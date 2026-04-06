/**
 * Stream Resolver — إرجاع فوري لروابط Embed
 * يستخدم مصادر متعددة مع احتياطي تلقائي
 */

// ═══════════════════════════════════════════════════════
// بناء روابط Embed — مصادر متعددة مع احتياطي
// ═══════════════════════════════════════════════════════

function buildEmbedUrls(tmdbId, imdbId, type, season, episode) {
  const isTv = type === 'tv' && season && episode;
  const sources = [];

  /* ── vidsrc.xyz FIRST — best coverage + built-in Arabic subtitle selector ── */
  sources.push({
    name: 'vidsrc.xyz ★',
    url: isTv
      ? `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
      : `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`,
  });

  sources.push({
    name: 'vidsrc.cc',
    url: isTv
      ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
  });

  sources.push({
    name: 'embed.su',
    url: isTv
      ? `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://embed.su/embed/movie/${tmdbId}`,
  });

  sources.push({
    name: 'vidsrc.me',
    url: isTv
      ? `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
      : `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`,
  });

  sources.push({
    name: 'vidsrc.to',
    url: isTv
      ? `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://vidsrc.to/embed/movie/${tmdbId}`,
  });

  sources.push({
    name: 'vidplay',
    url: isTv
      ? `https://vidplay.online/e/${tmdbId}?s=${season}&e=${episode}`
      : `https://vidplay.online/e/${tmdbId}`,
  });

  sources.push({
    name: 'autoembed.cc',
    url: isTv
      ? `https://autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://autoembed.cc/embed/movie/${tmdbId}`,
  });

  sources.push({
    name: '2embed.cc',
    url: isTv
      ? `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${tmdbId}`,
  });

  sources.push({
    name: 'vidsrc.icu',
    url: isTv
      ? `https://vidsrc.icu/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://vidsrc.icu/embed/movie/${tmdbId}`,
  });

  sources.push({
    name: 'vidsrc.nl',
    url: isTv
      ? `https://player.vidsrc.nl/embed/tv/${tmdbId}/${season}/${episode}`
      : `https://player.vidsrc.nl/embed/movie/${tmdbId}`,
  });

  if (imdbId) {
    sources.push({
      name: 'multiembed.mov',
      url: isTv
        ? `https://multiembed.mov/?video_id=${imdbId}&s=${season}&e=${episode}`
        : `https://multiembed.mov/?video_id=${imdbId}`,
    });
  }

  return sources;
}

// ═══════════════════════════════════════════════════════
// الدالة الرئيسية — إرجاع كل المصادر المتاحة
// ═══════════════════════════════════════════════════════

async function resolveStream(tmdbId, type = 'movie', season, episode, imdbId) {
  const sources = buildEmbedUrls(tmdbId, imdbId, type, season, episode);
  const tv = type === 'tv' && season && episode;
  console.log(`[Resolver] tmdb=${tmdbId} type=${type}${tv ? ` s${season}e${episode}` : ''} — ${sources.length} مصادر`);

  return {
    embedUrl: sources[0].url,
    provider: sources[0].name,
    sources: sources.map(s => ({ url: s.url, name: s.name })),
    // إرجاع كل الروابط للاستخدام الاحتياطي
    allEmbedUrls: sources.map(s => s.url),
  };
}

module.exports = { resolveStream };
